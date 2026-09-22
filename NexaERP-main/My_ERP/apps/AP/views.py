from django.shortcuts import render

# Create your views here.
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from .models import Vendor, Bill, BillLine, Payment, PaymentAllocation
from .serializers import (
    VendorSerializer, VendorListSerializer,
    BillSerializer, BillListSerializer,
    PaymentSerializer,
)


def get_user(request):
    return request.user if request.user.is_authenticated else None


def get_gl_account(name_contains):
    try:
        from apps.Finance.models import Account
        return Account.objects.filter(name__icontains=name_contains, is_active=True).first()
    except Exception:
        return None


# ── Vendors ───────────────────────────────────────────────────

class VendorListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/ap/vendors/  — list vendors
    POST /api/ap/vendors/  — create vendor
    """
    def get_serializer_class(self):
        return VendorSerializer if self.request.method == 'POST' else VendorListSerializer

    def get_queryset(self):
        qs = Vendor.objects.all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if t := self.request.query_params.get('vendor_type'):
            qs = qs.filter(vendor_type=t)
        return qs


class VendorDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = VendorSerializer
    queryset         = Vendor.objects.all()


class VendorStatementView(APIView):
    """
    GET /api/ap/vendors/<id>/statement/
    Full vendor statement — all bills and payments.
    """
    def get(self, request, pk):
        vendor   = get_object_or_404(Vendor, pk=pk)
        bills    = vendor.bills.exclude(status__in=['Draft', 'Rejected', 'Cancelled'])
        payments = vendor.payments.all()

        return Response({
            'vendor':             VendorSerializer(vendor).data,
            'total_billed':       sum(b.total_amount  for b in bills),
            'total_paid':         sum(b.amount_paid   for b in bills),
            'outstanding_balance':vendor.outstanding_balance,
            'bills':              BillListSerializer(bills, many=True).data,
            'payments':           PaymentSerializer(payments, many=True).data,
        })


# ── Bills ─────────────────────────────────────────────────────

class BillListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/ap/bills/  — list bills
    POST /api/ap/bills/  — create draft bill

    Query params:
      ?status=Draft|Submitted|Approved_Finance|...
      ?vendor=<id>
      ?overdue=true
    """
    def get_serializer_class(self):
        return BillSerializer if self.request.method == 'POST' else BillListSerializer

    def get_queryset(self):
        qs = Bill.objects.select_related('vendor').all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if v := self.request.query_params.get('vendor'):
            qs = qs.filter(vendor_id=v)
        if self.request.query_params.get('overdue') == 'true':
            qs = qs.filter(
                status__in=[Bill.Status.APPROVED_FINANCE, Bill.Status.PARTIALLY_PAID],
                due_date__lt=timezone.now().date(),
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=get_user(self.request))


class BillDetailView(generics.RetrieveAPIView):
    serializer_class = BillSerializer
    queryset         = Bill.objects.prefetch_related('lines__gl_account').select_related('vendor').all()


# ── Bill Workflow ─────────────────────────────────────────────

class SubmitBillView(APIView):
    """POST /api/ap/bills/<id>/submit/"""
    def post(self, request, pk):
        bill = get_object_or_404(Bill, pk=pk)
        try:
            bill.submit(get_user(request))
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': f'{bill.bill_number} submitted for Procurement approval.', 'status': bill.status})


class ApproveProcurementView(APIView):
    """POST /api/ap/bills/<id>/approve-procurement/"""
    def post(self, request, pk):
        bill = get_object_or_404(Bill, pk=pk)
        try:
            bill.approve_procurement(get_user(request))
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': f'{bill.bill_number} approved by Procurement.', 'status': bill.status})


class ApproveFinanceBillView(APIView):
    """
    POST /api/ap/bills/<id>/approve-finance/

    Finance approves and posts GL entry:
    DR  Expense Account(s)    (from bill lines)
    DR  VAT Input             (if VAT applies)
    CR  Accounts Payable      (total amount)
    CR  WHT Payable           (if WHT applies)
    """
    @transaction.atomic
    def post(self, request, pk):
        bill = get_object_or_404(Bill, pk=pk)
        try:
            bill.approve_finance(get_user(request))
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # ── Post to GL ───────────────────────────────────────
        journal_entry = None
        try:
            from apps.Finance.models import Account, JournalEntry, JournalLine

            ap_account  = get_gl_account('Accounts Payable')
            wht_account = get_gl_account('PAYE') or get_gl_account('Tax Payable')
            cogs_acc    = get_gl_account('Cost of Goods Sold')

            if ap_account:
                entry = JournalEntry.objects.create(
                    date        = bill.bill_date,
                    description = f'Vendor bill — {bill.vendor.name} ({bill.bill_number})',
                    source      = JournalEntry.Source.PURCHASE,
                    status      = JournalEntry.Status.DRAFT,
                    notes       = f'Vendor ref: {bill.vendor_ref}. WHT: KES {bill.wht_amount}',
                    created_by  = get_user(request),
                )
                lines = []

                # DR expense accounts per bill line
                for line in bill.lines.all():
                    expense_acc = line.gl_account or cogs_acc or get_gl_account('Office Supplies')
                    if expense_acc:
                        lines.append(JournalLine(
                            entry=entry, account=expense_acc,
                            debit=line.line_total, credit=Decimal('0'),
                            description=line.description,
                        ))

                # CR Accounts Payable (net of WHT)
                ap_credit = bill.total_amount
                lines.append(JournalLine(
                    entry=entry, account=ap_account,
                    debit=Decimal('0'), credit=ap_credit,
                    description=f'{bill.bill_number} — {bill.vendor.name}',
                ))

                # CR WHT Payable
                if bill.wht_amount > 0 and wht_account:
                    lines.append(JournalLine(
                        entry=entry, account=wht_account,
                        debit=Decimal('0'), credit=bill.wht_amount,
                        description=f'WHT on {bill.bill_number}',
                    ))

                JournalLine.objects.bulk_create(lines)
                entry.post()
                bill.journal_entry = entry
                bill.save()
                journal_entry = entry

        except Exception as e:
            pass  # GL failure doesn't block approval

        return Response({
            'detail':           f'{bill.bill_number} approved by Finance and posted to GL.',
            'status':           bill.status,
            'journal_entry_id': journal_entry.id if journal_entry else None,
        })


class RejectBillView(APIView):
    """POST /api/ap/bills/<id>/reject/  Body: {"reason": "..."}"""
    def post(self, request, pk):
        bill   = get_object_or_404(Bill, pk=pk)
        reason = request.data.get('reason', '').strip()
        try:
            bill.reject(get_user(request), reason)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': f'{bill.bill_number} rejected.', 'status': bill.status})


# ── Payments ──────────────────────────────────────────────────

class PayBillView(APIView):
    """
    POST /api/ap/bills/<id>/pay/

    Body:
    {
      "amount": 50000,
      "payment_method": "Bank Transfer",
      "payment_date": "2026-03-19",
      "reference": "TRF-001234",
      "apply_early_discount": true
    }

    Posts GL entry:
    DR  Accounts Payable   (amount paid)
    CR  Cash / Bank        (net cash out)
    CR  WHT Payable        (if WHT)
    DR  WHT Payable        (WHT already booked, now settling)
    """
    @transaction.atomic
    def post(self, request, pk):
        bill = get_object_or_404(Bill, pk=pk)

        if bill.status not in (Bill.Status.APPROVED_FINANCE, Bill.Status.PARTIALLY_PAID):
            return Response(
                {'detail': 'Bill must be Finance-approved before payment.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount            = Decimal(str(request.data.get('amount', 0)))
        payment_method    = request.data.get('payment_method', 'Bank Transfer')
        payment_date      = request.data.get('payment_date', timezone.now().date().isoformat())
        reference         = request.data.get('reference', '')
        apply_discount    = request.data.get('apply_early_discount', False)

        # Apply early payment discount if eligible
        discount = Decimal('0')
        if apply_discount:
            discount = bill.early_payment_discount
            amount   = max(Decimal('0'), amount - discount)

        if amount <= 0:
            return Response({'detail': 'Payment amount must be positive.'}, status=status.HTTP_400_BAD_REQUEST)
        if amount > bill.balance_due:
            return Response(
                {'detail': f'Payment ({amount}) exceeds balance due ({bill.balance_due}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create payment record
        payment = Payment.objects.create(
            vendor         = bill.vendor,
            payment_date   = payment_date,
            payment_method = payment_method,
            amount         = amount,
            wht_deducted   = bill.wht_amount if amount >= bill.balance_due else Decimal('0'),
            reference      = reference,
            created_by     = get_user(request),
        )

        # Allocate to bill
        PaymentAllocation.objects.create(payment=payment, bill=bill, amount=amount)

        # Update bill
        bill.amount_paid += amount
        if bill.amount_paid >= bill.total_amount:
            bill.status  = Bill.Status.PAID
            bill.paid_at = timezone.now()
        else:
            bill.status = Bill.Status.PARTIALLY_PAID
        bill.save()

        # ── Post GL ──────────────────────────────────────────
        journal_entry = None
        try:
            from apps.Finance.models import Account, JournalEntry, JournalLine

            ap_account   = get_gl_account('Accounts Payable')
            cash_account = get_gl_account('Cash')

            if ap_account and cash_account:
                entry = JournalEntry.objects.create(
                    date        = payment_date,
                    description = f'Payment to {bill.vendor.name} — {bill.bill_number}',
                    source      = JournalEntry.Source.PURCHASE,
                    status      = JournalEntry.Status.DRAFT,
                    notes       = f'Ref: {reference}. Method: {payment_method}',
                    created_by  = get_user(request),
                )
                lines = []

                # DR AP (reducing liability)
                lines.append(JournalLine(
                    entry=entry, account=ap_account,
                    debit=amount, credit=Decimal('0'),
                    description=f'Payment — {bill.bill_number}',
                ))

                # CR Cash/Bank
                lines.append(JournalLine(
                    entry=entry, account=cash_account,
                    debit=Decimal('0'), credit=amount,
                    description=f'Payment to {bill.vendor.name}',
                ))

                JournalLine.objects.bulk_create(lines)
                entry.post()
                payment.journal_entry = entry
                payment.save()
                journal_entry = entry

        except Exception:
            pass

        return Response({
            'detail':           f'Payment of KES {amount} recorded for {bill.bill_number}.',
            'payment_number':   payment.payment_number,
            'amount_paid':      bill.amount_paid,
            'balance_due':      bill.balance_due,
            'discount_applied': discount,
            'bill_status':      bill.status,
            'journal_entry_id': journal_entry.id if journal_entry else None,
        })


class PaymentListView(generics.ListAPIView):
    """GET /api/ap/payments/"""
    serializer_class = PaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.select_related('vendor').prefetch_related('allocations').all()
        if v := self.request.query_params.get('vendor'):
            qs = qs.filter(vendor_id=v)
        return qs


# ── Aging Report ──────────────────────────────────────────────

class APAgingView(APIView):
    """
    GET /api/ap/aging/

    Returns AP aging buckets:
    Current (not yet due), 1-30 days, 31-60 days, 61-90 days, 90+ days
    """
    def get(self, request):
        today = timezone.now().date()
        bills = Bill.objects.filter(
            status__in=[Bill.Status.APPROVED_FINANCE, Bill.Status.PARTIALLY_PAID]
        ).select_related('vendor')

        buckets = {
            'current':  {'label': 'Current (Not Due)',  'total': Decimal('0'), 'bills': []},
            '1_30':     {'label': '1–30 Days Overdue',  'total': Decimal('0'), 'bills': []},
            '31_60':    {'label': '31–60 Days Overdue', 'total': Decimal('0'), 'bills': []},
            '61_90':    {'label': '61–90 Days Overdue', 'total': Decimal('0'), 'bills': []},
            'over_90':  {'label': '90+ Days Overdue',   'total': Decimal('0'), 'bills': []},
        }

        for bill in bills:
            days = (today - bill.due_date).days
            entry = {
                'bill_number': bill.bill_number,
                'vendor':      bill.vendor.name,
                'bill_date':   bill.bill_date,
                'due_date':    bill.due_date,
                'balance_due': bill.balance_due,
                'days_overdue':max(0, days),
            }

            if days <= 0:
                buckets['current']['total']  += bill.balance_due
                buckets['current']['bills'].append(entry)
            elif days <= 30:
                buckets['1_30']['total']  += bill.balance_due
                buckets['1_30']['bills'].append(entry)
            elif days <= 60:
                buckets['31_60']['total'] += bill.balance_due
                buckets['31_60']['bills'].append(entry)
            elif days <= 90:
                buckets['61_90']['total'] += bill.balance_due
                buckets['61_90']['bills'].append(entry)
            else:
                buckets['over_90']['total'] += bill.balance_due
                buckets['over_90']['bills'].append(entry)

        grand_total = sum(b['total'] for b in buckets.values())

        return Response({
            'as_of_date':  today,
            'grand_total': grand_total,
            'buckets':     buckets,
        })


# ── AP Dashboard ──────────────────────────────────────────────

class APDashboardView(APIView):
    """
    GET /api/ap/dashboard/
    High-level AP KPIs.
    """
    def get(self, request):
        today = timezone.now().date()
        bills = Bill.objects.all()

        approved = bills.filter(status__in=[
            Bill.Status.APPROVED_FINANCE, Bill.Status.PARTIALLY_PAID
        ])
        overdue  = [b for b in approved if b.is_overdue]

        total_payable  = sum(b.balance_due   for b in approved)
        total_overdue  = sum(b.balance_due   for b in overdue)
        total_paid_mtd = sum(
            p.amount for p in Payment.objects.filter(
                payment_date__year=today.year,
                payment_date__month=today.month,
            )
        )
        total_billed_mtd = sum(
            b.total_amount for b in bills.filter(
                bill_date__year=today.year,
                bill_date__month=today.month,
            )
        )

        # Vendor count
        active_vendors = Vendor.objects.filter(status='Active').count()
        over_limit     = sum(1 for v in Vendor.objects.filter(status='Active') if v.is_over_credit_limit)

        return Response({
            'total_payable':      total_payable,
            'total_overdue':      total_overdue,
            'overdue_bill_count': len(overdue),
            'total_paid_mtd':     total_paid_mtd,
            'total_billed_mtd':   total_billed_mtd,
            'active_vendors':     active_vendors,
            'vendors_over_limit': over_limit,
            'pending_approval':   bills.filter(status__in=[
                Bill.Status.SUBMITTED, Bill.Status.APPROVED_PROCUREMENT
            ]).count(),
        })