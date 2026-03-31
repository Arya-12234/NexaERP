from rest_framework import serializers
from .models import Department, Employee, PayrollRun, Payslip


class DepartmentSerializer(serializers.ModelSerializer):
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model  = Department
        fields = ['id', 'name', 'description', 'employee_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_employee_count(self, obj):
        return obj.employees.filter(status='Active').count()


class EmployeeSerializer(serializers.ModelSerializer):
    full_name       = serializers.CharField(read_only=True)
    gross_salary    = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, default='')

    class Meta:
        model  = Employee
        fields = [
            'id', 'employee_number', 'first_name', 'last_name', 'full_name',
            'email', 'phone', 'national_id', 'kra_pin', 'nssf_number', 'shif_number',
            'department', 'department_name', 'job_title', 'employment_type',
            'status', 'date_joined', 'date_terminated',
            'basic_salary', 'house_allowance', 'transport_allowance',
            'other_allowances', 'gross_salary', 'insurance_premium',
            'payment_method', 'bank_name', 'bank_branch', 'account_number', 'mpesa_number',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'employee_number', 'full_name', 'gross_salary',
                            'created_at', 'updated_at']


class EmployeeListSerializer(serializers.ModelSerializer):
    full_name       = serializers.CharField(read_only=True)
    gross_salary    = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, default='')

    class Meta:
        model  = Employee
        fields = ['id', 'employee_number', 'full_name', 'job_title',
                  'department_name', 'employment_type', 'status',
                  'basic_salary', 'gross_salary']


class PayslipSerializer(serializers.ModelSerializer):
    employee_name   = serializers.CharField(source='employee.full_name',        read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number',   read_only=True)
    job_title       = serializers.CharField(source='employee.job_title',         read_only=True)
    department      = serializers.CharField(source='employee.department.name',   read_only=True, default='')
    kra_pin         = serializers.CharField(source='employee.kra_pin',           read_only=True)
    nssf_number     = serializers.CharField(source='employee.nssf_number',       read_only=True)
    bank_name       = serializers.CharField(source='employee.bank_name',         read_only=True)
    account_number  = serializers.CharField(source='employee.account_number',    read_only=True)
    payment_method  = serializers.CharField(source='employee.payment_method',    read_only=True)

    class Meta:
        model  = Payslip
        fields = [
            'id', 'employee', 'employee_name', 'employee_number',
            'job_title', 'department', 'kra_pin', 'nssf_number',
            'bank_name', 'account_number', 'payment_method', 'status',
            'basic_salary', 'house_allowance', 'transport_allowance',
            'other_allowances', 'gross_salary',
            'paye', 'nssf_tier1', 'nssf_tier2', 'nssf_total',
            'shif', 'housing_levy', 'total_deductions',
            'employer_nssf', 'employer_housing',
            'net_pay', 'taxable_income', 'personal_relief',
            'created_at',
        ]
        read_only_fields = fields


class ApprovalHistorySerializer(serializers.Serializer):
    """Read-only audit trail of a payroll run's approval stages."""
    stage      = serializers.CharField()
    actor      = serializers.CharField()
    timestamp  = serializers.DateTimeField()
    comment    = serializers.CharField()


class PayrollRunSerializer(serializers.ModelSerializer):
    totals              = serializers.SerializerMethodField()
    period_label        = serializers.CharField(read_only=True)
    payslips            = PayslipSerializer(many=True, read_only=True)
    approval_history    = serializers.SerializerMethodField()

    # Approval actor names
    created_by_name         = serializers.CharField(source='created_by.get_full_name',          read_only=True, default='')
    submitted_by_name       = serializers.CharField(source='submitted_by.get_full_name',        read_only=True, default='')
    hr_approved_by_name     = serializers.CharField(source='hr_approved_by.get_full_name',      read_only=True, default='')
    finance_approved_by_name= serializers.CharField(source='finance_approved_by.get_full_name', read_only=True, default='')
    rejected_by_name        = serializers.CharField(source='rejected_by.get_full_name',         read_only=True, default='')

    class Meta:
        model  = PayrollRun
        fields = [
            'id', 'reference', 'period_year', 'period_month', 'period_label',
            'description', 'status', 'rejection_reason',
            'totals', 'payslips', 'approval_history',
            'created_by_name', 'submitted_by_name',
            'hr_approved_by_name', 'finance_approved_by_name', 'rejected_by_name',
            'created_at', 'submitted_at', 'hr_approved_at',
            'finance_approved_at', 'rejected_at', 'paid_at',
        ]
        read_only_fields = [f for f in fields if f not in ('period_year', 'period_month', 'description')]

    def get_totals(self, obj):
        return obj.get_totals()

    def get_approval_history(self, obj):
        history = []
        if obj.created_at:
            history.append({
                'stage':     'Created',
                'actor':     obj.created_by.get_full_name() if obj.created_by else 'System',
                'timestamp': obj.created_at,
                'comment':   '',
            })
        if obj.submitted_at:
            history.append({
                'stage':     'Submitted for Approval',
                'actor':     obj.submitted_by.get_full_name() if obj.submitted_by else '—',
                'timestamp': obj.submitted_at,
                'comment':   '',
            })
        if obj.hr_approved_at:
            history.append({
                'stage':     'HR Approved',
                'actor':     obj.hr_approved_by.get_full_name() if obj.hr_approved_by else '—',
                'timestamp': obj.hr_approved_at,
                'comment':   '',
            })
        if obj.finance_approved_at:
            history.append({
                'stage':     'Finance Approved — GL Posted',
                'actor':     obj.finance_approved_by.get_full_name() if obj.finance_approved_by else '—',
                'timestamp': obj.finance_approved_at,
                'comment':   '',
            })
        if obj.rejected_at:
            history.append({
                'stage':     'Rejected',
                'actor':     obj.rejected_by.get_full_name() if obj.rejected_by else '—',
                'timestamp': obj.rejected_at,
                'comment':   obj.rejection_reason,
            })
        if obj.paid_at:
            history.append({
                'stage':     'Marked as Paid',
                'actor':     '—',
                'timestamp': obj.paid_at,
                'comment':   '',
            })
        return history


class PayrollRunListSerializer(serializers.ModelSerializer):
    totals       = serializers.SerializerMethodField()
    period_label = serializers.CharField(read_only=True)

    class Meta:
        model  = PayrollRun
        fields = [
            'id', 'reference', 'period_year', 'period_month', 'period_label',
            'description', 'status', 'totals',
            'created_at', 'submitted_at', 'hr_approved_at',
            'finance_approved_at', 'paid_at',
        ]

    def get_totals(self, obj):
        return obj.get_totals()