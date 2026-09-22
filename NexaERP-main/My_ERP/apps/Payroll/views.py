import csv
import io
import calendar
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Department, Employee, PayrollRun, Payslip
from .serializers import (
    DepartmentSerializer,
    EmployeeSerializer,
    EmployeeListSerializer,
    PayrollRunSerializer,
    PayrollRunListSerializer,
    PayslipSerializer,
)
from .tax_engine import calculate_payslip


# ── Helpers ───────────────────────────────────────────────────

def get_user(request):
    return request.user if request.user.is_authenticated else None


def csv_response(filename, headers, rows):
    """Return a CSV file as an HTTP response."""
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return response


# ── Departments ───────────────────────────────────────────────

class DepartmentListCreateView(generics.ListCreateAPIView):
    serializer_class = DepartmentSerializer
    queryset         = Department.objects.all()


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DepartmentSerializer
    queryset         = Department.objects.all()


# ── Employees ─────────────────────────────────────────────────

class EmployeeListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return EmployeeSerializer if self.request.method == 'POST' else EmployeeListSerializer

    def get_queryset(self):
        qs = Employee.objects.select_related('department').all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if d := self.request.query_params.get('department'):
            qs = qs.filter(department_id=d)
        if t := self.request.query_params.get('employment_type'):
            qs = qs.filter(employment_type=t)
        return qs


class EmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EmployeeSerializer
    queryset         = Employee.objects.select_related('department').all()

    def destroy(self, request, *args, **kwargs):
        employee = self.get_object()
        employee.status          = Employee.Status.TERMINATED
        employee.date_terminated = timezone.now().date()
        employee.save()
        return Response(
            {'detail': f'{employee.full_name} has been terminated.'},
            status=status.HTTP_200_OK,
        )


# ── Payroll Runs ──────────────────────────────────────────────

class PayrollRunListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return PayrollRunSerializer if self.request.method == 'POST' else PayrollRunListSerializer

    def get_queryset(self):
        qs = PayrollRun.objects.all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=get_user(self.request))


class PayrollRunDetailView(generics.RetrieveAPIView):
    serializer_class = PayrollRunSerializer
    queryset         = PayrollRun.objects.prefetch_related(
        'payslips__employee__department'
    ).all()


# ── Stage 2: Calculate Payslips ───────────────────────────────

class CalculatePayrollView(APIView):
    """
    POST /api/payroll/runs/<id>/calculate/

    Calculates payslips for all active employees.
    Run must be in DRAFT status.
    Can be re-run to recalculate (deletes existing payslips first).
    Does NOT post to GL — that happens at Finance approval.
    """
    @transaction.atomic
    def post(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)

        if run.status != PayrollRun.Status.DRAFT:
            return Response(
                {'detail': f'Cannot calculate payslips for a run with status "{run.status}". Reset to Draft first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employees = Employee.objects.filter(status=Employee.Status.ACTIVE).select_related('department')
        if not employees.exists():
            return Response(
                {'detail': 'No active employees found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Clear existing payslips for re-calculation
        run.payslips.all().delete()

        payslips = []
        for emp in employees:
            calc = calculate_payslip(emp.gross_salary, emp.insurance_premium)
            payslips.append(Payslip(
                run                 = run,
                employee            = emp,
                status              = Payslip.Status.DRAFT,
                basic_salary        = emp.basic_salary,
                house_allowance     = emp.house_allowance,
                transport_allowance = emp.transport_allowance,
                other_allowances    = emp.other_allowances,
                gross_salary        = calc['gross_salary'],
                paye                = calc['paye'],
                nssf_tier1          = calc['nssf_tier1'],
                nssf_tier2          = calc['nssf_tier2'],
                nssf_total          = calc['nssf_total'],
                shif                = calc['shif'],
                housing_levy        = calc['housing_levy'],
                total_deductions    = calc['total_deductions'],
                employer_nssf       = calc['employer_nssf'],
                employer_housing    = calc['employer_housing'],
                net_pay             = calc['net_pay'],
                taxable_income      = calc['taxable_income'],
                personal_relief     = calc['personal_relief'],
            ))

        Payslip.objects.bulk_create(payslips)

        totals = run.get_totals()
        return Response({
            'detail':  f'{totals["employee_count"]} payslips calculated.',
            'totals':  totals,
        }, status=status.HTTP_200_OK)


# ── Stage 3a: Submit for HR Approval ─────────────────────────

class SubmitPayrollView(APIView):
    """
    POST /api/payroll/runs/<id>/submit/
    Moves run from DRAFT → SUBMITTED (awaiting HR approval).
    """
    def post(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)
        try:
            run.submit(get_user(request))
        except ValidationError as e:
            return Response({'detail': e.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'detail': f'{run.reference} submitted for HR approval.',
            'status': run.status,
        })


# ── Stage 3b: HR Approval ─────────────────────────────────────

class ApproveHRView(APIView):
    """
    POST /api/payroll/runs/<id>/approve-hr/
    HR approves → APPROVED_HR (awaiting Finance approval).
    """
    def post(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)
        try:
            run.approve_hr(get_user(request))
        except ValidationError as e:
            return Response({'detail': e.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'detail': f'{run.reference} approved by HR. Awaiting Finance approval.',
            'status': run.status,
        })


# ── Stage 3c: Finance Approval + GL Posting ──────────────────

class ApproveFinanceView(APIView):
    """
    POST /api/payroll/runs/<id>/approve-finance/

    Finance approves → APPROVED_FINANCE.
    Automatically posts journal entries to the GL:
      DR  Salaries & Wages Expense    (total gross)
      DR  Employer NSSF Expense       (employer NSSF)
      DR  Employer Housing Expense    (employer housing)
      CR  PAYE Payable                (total PAYE)
      CR  NSSF Payable                (employee + employer NSSF)
      CR  SHIF Payable                (total SHIF)
      CR  Housing Levy Payable        (employee + employer housing)
      CR  Accrued Salaries Payable    (total net pay)
    """
    @transaction.atomic
    def post(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)
        try:
            run.approve_finance(get_user(request))
        except ValidationError as e:
            return Response({'detail': e.message}, status=status.HTTP_400_BAD_REQUEST)

        # ── Post to GL ───────────────────────────────────────
        try:
            from apps.Finance.models import Account, JournalEntry, JournalLine

            def get_account(name_contains):
                return Account.objects.filter(
                    name__icontains=name_contains, is_active=True
                ).first()

            totals      = run.get_totals()
            total_gross = totals['total_gross']
            total_paye  = totals['total_paye']
            total_nssf  = totals['total_nssf']
            total_shif  = totals['total_shif']
            total_housing = totals['total_housing']
            total_net   = totals['total_net']

            emp_nssf    = sum(p.employer_nssf    for p in run.payslips.all())
            emp_housing = sum(p.employer_housing for p in run.payslips.all())

            salaries_acc = get_account('Salaries')
            paye_acc     = get_account('PAYE')
            nssf_acc     = get_account('NSSF')
            shif_acc     = get_account('NHIF') or get_account('SHIF')
            housing_acc  = get_account('Housing')
            accrued_acc  = get_account('Accrued Salaries')

            if not salaries_acc:
                raise ValueError('Salaries & Wages account not found in GL.')

            entry = JournalEntry.objects.create(
                date        = timezone.now().date(),
                description = f'Payroll — {run.period_label}',
                source      = JournalEntry.Source.PAYROLL,
                status      = JournalEntry.Status.DRAFT,
                notes       = f'Auto-generated. Run: {run.reference}. Approved by: {request.user}',
                created_by  = get_user(request),
            )

            lines = []

            # ── Debits ──────────────────────────────────────
            lines.append(JournalLine(
                entry=entry, account=salaries_acc,
                debit=total_gross, credit=Decimal('0'),
                description='Gross payroll cost',
            ))

            # ── Credits ─────────────────────────────────────
            if paye_acc and total_paye > 0:
                lines.append(JournalLine(
                    entry=entry, account=paye_acc,
                    debit=Decimal('0'), credit=total_paye,
                    description='PAYE withheld — due to KRA',
                ))

            nssf_total_both = total_nssf + emp_nssf
            if nssf_acc and nssf_total_both > 0:
                lines.append(JournalLine(
                    entry=entry, account=nssf_acc,
                    debit=Decimal('0'), credit=nssf_total_both,
                    description='NSSF (employee + employer) — due to NSSF',
                ))

            if shif_acc and total_shif > 0:
                lines.append(JournalLine(
                    entry=entry, account=shif_acc,
                    debit=Decimal('0'), credit=total_shif,
                    description='SHIF — due to SHA',
                ))

            housing_total_both = total_housing + emp_housing
            if housing_acc and housing_total_both > 0:
                lines.append(JournalLine(
                    entry=entry, account=housing_acc,
                    debit=Decimal('0'), credit=housing_total_both,
                    description='Housing Levy (employee + employer) — due to NHFC',
                ))

            # Net salaries payable
            net_payable = total_gross - total_paye - total_nssf - total_shif - total_housing
            if accrued_acc and net_payable > 0:
                lines.append(JournalLine(
                    entry=entry, account=accrued_acc,
                    debit=Decimal('0'), credit=net_payable,
                    description='Net salaries payable to employees',
                ))

            JournalLine.objects.bulk_create(lines)
            entry.post()

            run.journal_entry = entry
            run.save()

        except Exception as e:
            return Response({
                'detail': f'Finance approval saved but GL posting failed: {str(e)}. Post manually.',
                'status': run.status,
            }, status=status.HTTP_207_MULTI_STATUS)

        return Response({
            'detail': f'{run.reference} approved by Finance and posted to GL.',
            'status': run.status,
            'journal_entry_id': run.journal_entry.id if run.journal_entry else None,
        })


# ── Reject ────────────────────────────────────────────────────

class RejectPayrollView(APIView):
    """
    POST /api/payroll/runs/<id>/reject/
    Body: { "reason": "..." }
    """
    def post(self, request, pk):
        run    = get_object_or_404(PayrollRun, pk=pk)
        reason = request.data.get('reason', '').strip()
        try:
            run.reject(get_user(request), reason)
        except ValidationError as e:
            return Response({'detail': e.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'detail': f'{run.reference} rejected.',
            'reason': reason,
            'status': run.status,
        })


# ── Mark Paid ─────────────────────────────────────────────────

class MarkPaidView(APIView):
    """
    POST /api/payroll/runs/<id>/mark-paid/
    Records that bank transfers have been made.
    """
    def post(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)
        try:
            run.mark_paid(get_user(request))
        except ValidationError as e:
            return Response({'detail': e.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'detail': f'{run.reference} marked as paid.',
            'status': run.status,
        })


# ── Payslips ──────────────────────────────────────────────────

class PayrollRunPayslipsView(generics.ListAPIView):
    serializer_class = PayslipSerializer

    def get_queryset(self):
        run = get_object_or_404(PayrollRun, pk=self.kwargs['pk'])
        return run.payslips.select_related('employee__department').all()


class PayslipDetailView(generics.RetrieveAPIView):
    serializer_class = PayslipSerializer
    queryset         = Payslip.objects.select_related('employee__department', 'run').all()


# ── Stage 5: Bank Payment File ────────────────────────────────

class PaymentFileView(APIView):
    """
    GET /api/payroll/runs/<id>/payment-file/

    Downloads a generic bank transfer CSV file.
    Format: Employee Name | Bank | Branch | Account | Amount | Reference
    Compatible with most Kenyan bank bulk payment portals.
    """
    def get(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)

        if run.status not in (
            PayrollRun.Status.APPROVED_FINANCE,
            PayrollRun.Status.PAID,
        ):
            return Response(
                {'detail': 'Payment file only available after Finance approval.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payslips = run.payslips.select_related('employee').filter(
            employee__payment_method=Employee.PaymentMethod.BANK_TRANSFER
        )

        headers = [
            'Employee Number', 'Employee Name', 'Bank Name', 'Branch',
            'Account Number', 'Net Pay (KES)', 'Payment Reference', 'Period',
        ]
        rows = []
        for p in payslips:
            rows.append([
                p.employee.employee_number,
                p.employee.full_name,
                p.employee.bank_name,
                p.employee.bank_branch,
                p.employee.account_number,
                p.net_pay,
                f'{run.reference}-{p.employee.employee_number}',
                run.period_label,
            ])

        return csv_response(
            filename=f'payment_file_{run.reference}.csv',
            headers=headers,
            rows=rows,
        )


# ── Stage 6: Statutory Remittance Reports ─────────────────────

class P10ReportView(APIView):
    """
    GET /api/payroll/runs/<id>/p10/

    KRA P10 Monthly PAYE Return (CSV format).
    Columns required by KRA iTax system.
    """
    def get(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)
        if not run.payslips.exists():
            return Response({'detail': 'No payslips found.'}, status=status.HTTP_400_BAD_REQUEST)

        headers = [
            'PIN of Employee', 'Employee Name', 'Gross Pay',
            'Taxable Pay', 'Tax Before Relief', 'Personal Relief',
            'Insurance Relief', 'PAYE Tax', 'Month', 'Year',
        ]
        rows = []
        for p in run.payslips.select_related('employee').all():
            rows.append([
                p.employee.kra_pin,
                p.employee.full_name,
                p.gross_salary,
                p.taxable_income,
                p.paye + p.personal_relief,  # gross tax before relief
                p.personal_relief,
                0,                            # insurance relief — extend if needed
                p.paye,
                run.period_month,
                run.period_year,
            ])

        return csv_response(
            filename=f'P10_PAYE_{run.reference}.csv',
            headers=headers,
            rows=rows,
        )


class NSSFRemittanceView(APIView):
    """
    GET /api/payroll/runs/<id>/nssf/

    NSSF monthly remittance schedule.
    """
    def get(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)
        if not run.payslips.exists():
            return Response({'detail': 'No payslips found.'}, status=status.HTTP_400_BAD_REQUEST)

        headers = [
            'NSSF Number', 'Employee Name', 'ID Number',
            'Gross Salary', 'Tier I (Employee)', 'Tier II (Employee)',
            'Total Employee', 'Total Employer', 'Total Contribution',
            'Month', 'Year',
        ]
        rows = []
        for p in run.payslips.select_related('employee').all():
            rows.append([
                p.employee.nssf_number,
                p.employee.full_name,
                p.employee.national_id,
                p.gross_salary,
                p.nssf_tier1,
                p.nssf_tier2,
                p.nssf_total,
                p.employer_nssf,
                p.nssf_total + p.employer_nssf,
                run.period_month,
                run.period_year,
            ])

        return csv_response(
            filename=f'NSSF_Remittance_{run.reference}.csv',
            headers=headers,
            rows=rows,
        )


class SHIFRemittanceView(APIView):
    """
    GET /api/payroll/runs/<id>/shif/

    SHIF (Social Health Insurance Fund) monthly remittance schedule.
    """
    def get(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)
        if not run.payslips.exists():
            return Response({'detail': 'No payslips found.'}, status=status.HTTP_400_BAD_REQUEST)

        headers = [
            'SHIF Number', 'Employee Name', 'ID Number',
            'Gross Salary', 'SHIF Contribution (2.75%)',
            'Month', 'Year',
        ]
        rows = []
        for p in run.payslips.select_related('employee').all():
            rows.append([
                p.employee.shif_number,
                p.employee.full_name,
                p.employee.national_id,
                p.gross_salary,
                p.shif,
                run.period_month,
                run.period_year,
            ])

        return csv_response(
            filename=f'SHIF_Remittance_{run.reference}.csv',
            headers=headers,
            rows=rows,
        )


class HousingLevyView(APIView):
    """
    GET /api/payroll/runs/<id>/housing-levy/

    Affordable Housing Levy remittance schedule.
    """
    def get(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)
        if not run.payslips.exists():
            return Response({'detail': 'No payslips found.'}, status=status.HTTP_400_BAD_REQUEST)

        headers = [
            'KRA PIN', 'Employee Name', 'ID Number',
            'Gross Salary',
            'Employee Levy (1.5%)', 'Employer Levy (1.5%)', 'Total Levy',
            'Month', 'Year',
        ]
        rows = []
        for p in run.payslips.select_related('employee').all():
            rows.append([
                p.employee.kra_pin,
                p.employee.full_name,
                p.employee.national_id,
                p.gross_salary,
                p.housing_levy,
                p.employer_housing,
                p.housing_levy + p.employer_housing,
                run.period_month,
                run.period_year,
            ])

        return csv_response(
            filename=f'HousingLevy_{run.reference}.csv',
            headers=headers,
            rows=rows,
        )


# ── Summary ───────────────────────────────────────────────────

class PayrollSummaryView(APIView):
    """
    GET /api/payroll/runs/<id>/summary/

    Returns a full payroll cost summary including employer contributions
    and total cost to company (CTC).
    """
    def get(self, request, pk):
        run = get_object_or_404(PayrollRun, pk=pk)
        totals = run.get_totals()

        emp_nssf    = sum(p.employer_nssf    for p in run.payslips.all())
        emp_housing = sum(p.employer_housing for p in run.payslips.all())

        return Response({
            'reference':          run.reference,
            'period':             run.period_label,
            'status':             run.status,
            'employee_count':     totals['employee_count'],

            # Employee costs
            'total_gross':        totals['total_gross'],
            'total_paye':         totals['total_paye'],
            'total_nssf_employee':totals['total_nssf'],
            'total_shif':         totals['total_shif'],
            'total_housing_employee': totals['total_housing'],
            'total_deductions':   (
                totals['total_paye'] + totals['total_nssf'] +
                totals['total_shif'] + totals['total_housing']
            ),
            'total_net_pay':      totals['total_net'],

            # Employer costs
            'employer_nssf':      emp_nssf,
            'employer_housing':   emp_housing,

            # Total cost to company
            'total_ctc':          totals['total_gross'] + emp_nssf + emp_housing,

            # Statutory remittances due
            'kra_paye_due':       totals['total_paye'],
            'nssf_due':           totals['total_nssf'] + emp_nssf,
            'shif_due':           totals['total_shif'],
            'housing_levy_due':   totals['total_housing'] + emp_housing,
        })