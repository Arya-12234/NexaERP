from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal


class Department(models.Model):
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Employee(models.Model):
    class EmploymentType(models.TextChoices):
        FULL_TIME  = 'Full-Time',  'Full-Time'
        PART_TIME  = 'Part-Time',  'Part-Time'
        CONTRACT   = 'Contract',   'Contract'
        INTERN     = 'Intern',     'Intern'

    class Status(models.TextChoices):
        ACTIVE     = 'Active',     'Active'
        INACTIVE   = 'Inactive',   'Inactive'
        TERMINATED = 'Terminated', 'Terminated'

    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = 'Bank Transfer', 'Bank Transfer'
        MPESA         = 'M-Pesa',        'M-Pesa'
        CASH          = 'Cash',          'Cash'

    # Personal details
    employee_number  = models.CharField(max_length=20, unique=True, editable=False)
    first_name       = models.CharField(max_length=60)
    last_name        = models.CharField(max_length=60)
    email            = models.EmailField(unique=True)
    phone            = models.CharField(max_length=20, blank=True)
    national_id      = models.CharField(max_length=20, unique=True)
    kra_pin          = models.CharField(max_length=20, blank=True)
    nssf_number      = models.CharField(max_length=20, blank=True)
    shif_number      = models.CharField(max_length=20, blank=True)

    # Employment details
    department       = models.ForeignKey(Department, on_delete=models.PROTECT,
                                          related_name='employees', null=True, blank=True)
    job_title        = models.CharField(max_length=100)
    employment_type  = models.CharField(max_length=20, choices=EmploymentType.choices,
                                         default=EmploymentType.FULL_TIME)
    status           = models.CharField(max_length=20, choices=Status.choices,
                                         default=Status.ACTIVE)
    date_joined      = models.DateField()
    date_terminated  = models.DateField(null=True, blank=True)

    # Compensation
    basic_salary         = models.DecimalField(max_digits=12, decimal_places=2)
    house_allowance      = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transport_allowance  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_allowances     = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    insurance_premium    = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                                help_text='Monthly insurance premium for relief')

    # Bank / payment details
    payment_method   = models.CharField(max_length=20, choices=PaymentMethod.choices,
                                         default=PaymentMethod.BANK_TRANSFER)
    bank_name        = models.CharField(max_length=100, blank=True)
    bank_branch      = models.CharField(max_length=100, blank=True)
    account_number   = models.CharField(max_length=30, blank=True)
    mpesa_number     = models.CharField(max_length=20, blank=True)

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f'{self.employee_number} — {self.full_name}'

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'

    @property
    def gross_salary(self):
        return (
            self.basic_salary        +
            self.house_allowance     +
            self.transport_allowance +
            self.other_allowances
        )

    def save(self, *args, **kwargs):
        if not self.employee_number:
            super().save(*args, **kwargs)
            self.employee_number = f'EMP-{self.pk:05d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)


class PayrollRun(models.Model):
    """
    Full lifecycle of a payroll run:

    DRAFT
      └─► SUBMITTED          (submitted for HR approval)
            ├─► REJECTED     (HR or Finance rejects with mandatory reason)
            └─► APPROVED_HR  (HR approves)
                  ├─► REJECTED
                  └─► APPROVED_FINANCE  (Finance approves + GL auto-posted)
                        └─► PAID        (bank transfers confirmed)
    """

    class Status(models.TextChoices):
        DRAFT            = 'Draft',            'Draft'
        SUBMITTED        = 'Submitted',        'Submitted — Awaiting HR Approval'
        APPROVED_HR      = 'Approved_HR',      'Approved by HR'
        APPROVED_FINANCE = 'Approved_Finance', 'Approved by Finance — Posted to GL'
        PAID             = 'Paid',             'Paid'
        REJECTED         = 'Rejected',         'Rejected'

    reference     = models.CharField(max_length=30, unique=True, editable=False)
    period_year   = models.IntegerField()
    period_month  = models.IntegerField()
    description   = models.CharField(max_length=255, blank=True)
    status        = models.CharField(max_length=20, choices=Status.choices,
                                      default=Status.DRAFT)

    # Approval audit trail
    created_by          = models.ForeignKey('auth.User', null=True, blank=True,
                                             on_delete=models.SET_NULL,
                                             related_name='payroll_runs_created')
    submitted_by        = models.ForeignKey('auth.User', null=True, blank=True,
                                             on_delete=models.SET_NULL,
                                             related_name='payroll_runs_submitted')
    hr_approved_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                             on_delete=models.SET_NULL,
                                             related_name='payroll_runs_hr_approved')
    finance_approved_by = models.ForeignKey('auth.User', null=True, blank=True,
                                             on_delete=models.SET_NULL,
                                             related_name='payroll_runs_finance_approved')
    rejected_by         = models.ForeignKey('auth.User', null=True, blank=True,
                                             on_delete=models.SET_NULL,
                                             related_name='payroll_runs_rejected')
    rejection_reason    = models.TextField(blank=True)

    # Timestamps
    created_at          = models.DateTimeField(auto_now_add=True)
    submitted_at        = models.DateTimeField(null=True, blank=True)
    hr_approved_at      = models.DateTimeField(null=True, blank=True)
    finance_approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at         = models.DateTimeField(null=True, blank=True)
    paid_at             = models.DateTimeField(null=True, blank=True)

    # GL link — set after Finance approval
    journal_entry = models.OneToOneField(
        'Finance.JournalEntry',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='payroll_run',
    )

    class Meta:
        ordering        = ['-period_year', '-period_month']
        unique_together = [['period_year', 'period_month']]
        verbose_name    = 'Payroll Run'

    def __str__(self):
        return f'{self.reference} — {self.period_label} [{self.status}]'

    def save(self, *args, **kwargs):
        if not self.reference:
            super().save(*args, **kwargs)
            self.reference = f'PR-{self.period_year}-{self.period_month:02d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    @property
    def period_label(self):
        import calendar
        return f'{calendar.month_name[self.period_month]} {self.period_year}'

    def get_totals(self):
        payslips = self.payslips.all()
        return {
            'total_gross':    sum(p.gross_salary  for p in payslips),
            'total_paye':     sum(p.paye          for p in payslips),
            'total_nssf':     sum(p.nssf_total    for p in payslips),
            'total_shif':     sum(p.shif          for p in payslips),
            'total_housing':  sum(p.housing_levy  for p in payslips),
            'total_net':      sum(p.net_pay       for p in payslips),
            'employee_count': payslips.count(),
        }

    # ── Workflow transitions ──────────────────────────────────

    def submit(self, user):
        if self.status != self.Status.DRAFT:
            raise ValidationError('Only Draft runs can be submitted.')
        if not self.payslips.exists():
            raise ValidationError('Calculate payslips before submitting.')
        self.status       = self.Status.SUBMITTED
        self.submitted_by = user
        self.submitted_at = timezone.now()
        self.save()

    def approve_hr(self, user):
        if self.status != self.Status.SUBMITTED:
            raise ValidationError('Run must be Submitted before HR approval.')
        self.status         = self.Status.APPROVED_HR
        self.hr_approved_by = user
        self.hr_approved_at = timezone.now()
        self.save()

    def approve_finance(self, user):
        if self.status != self.Status.APPROVED_HR:
            raise ValidationError('Run must have HR approval before Finance approval.')
        self.status              = self.Status.APPROVED_FINANCE
        self.finance_approved_by = user
        self.finance_approved_at = timezone.now()
        self.save()

    def reject(self, user, reason):
        if self.status not in (self.Status.SUBMITTED, self.Status.APPROVED_HR):
            raise ValidationError('Only Submitted or HR-Approved runs can be rejected.')
        if not reason or not reason.strip():
            raise ValidationError('A rejection reason is required.')
        self.status           = self.Status.REJECTED
        self.rejected_by      = user
        self.rejected_at      = timezone.now()
        self.rejection_reason = reason
        self.save()

    def mark_paid(self, user):
        if self.status != self.Status.APPROVED_FINANCE:
            raise ValidationError('Run must be Finance-approved before marking as paid.')
        self.status  = self.Status.PAID
        self.paid_at = timezone.now()
        self.save()


class Payslip(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'Draft', 'Draft'
        FINAL = 'Final', 'Final'
        PAID  = 'Paid',  'Paid'

    run                 = models.ForeignKey(PayrollRun, on_delete=models.CASCADE,
                                             related_name='payslips')
    employee            = models.ForeignKey(Employee, on_delete=models.PROTECT,
                                             related_name='payslips')
    status              = models.CharField(max_length=10, choices=Status.choices,
                                            default=Status.DRAFT)

    # Earnings
    basic_salary        = models.DecimalField(max_digits=12, decimal_places=2)
    house_allowance     = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_allowances    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gross_salary        = models.DecimalField(max_digits=12, decimal_places=2)

    # Statutory deductions
    paye                = models.DecimalField(max_digits=12, decimal_places=2)
    nssf_tier1          = models.DecimalField(max_digits=10, decimal_places=2)
    nssf_tier2          = models.DecimalField(max_digits=10, decimal_places=2)
    nssf_total          = models.DecimalField(max_digits=10, decimal_places=2)
    shif                = models.DecimalField(max_digits=10, decimal_places=2)
    housing_levy        = models.DecimalField(max_digits=10, decimal_places=2)
    total_deductions    = models.DecimalField(max_digits=12, decimal_places=2)

    # Employer contributions
    employer_nssf       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    employer_housing    = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Net
    net_pay             = models.DecimalField(max_digits=12, decimal_places=2)

    # Tax detail
    taxable_income      = models.DecimalField(max_digits=12, decimal_places=2)
    personal_relief     = models.DecimalField(max_digits=10, decimal_places=2)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering        = ['employee__last_name']
        unique_together = [['run', 'employee']]

    def __str__(self):
        return f'{self.run.reference} | {self.employee.full_name}'