from django.db import models

# Create your models here.
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal


class Vendor(models.Model):
    class VendorType(models.TextChoices):
        SUPPLIER    = 'Supplier',    'Supplier'
        CONTRACTOR  = 'Contractor',  'Contractor'
        CONSULTANT  = 'Consultant',  'Consultant'
        UTILITY     = 'Utility',     'Utility'
        LANDLORD    = 'Landlord',    'Landlord'
        OTHER       = 'Other',       'Other'

    class Status(models.TextChoices):
        ACTIVE      = 'Active',   'Active'
        INACTIVE    = 'Inactive', 'Inactive'
        BLACKLISTED = 'Blacklisted', 'Blacklisted'

    class WHTCategory(models.TextChoices):
        NONE            = 'None',            'None (No WHT)'
        CONSULTANCY     = 'Consultancy',     'Consultancy / Professional Fees (5%)'
        RENT            = 'Rent',            'Rent (10%)'
        DIVIDENDS       = 'Dividends',       'Dividends (5%)'
        CONTRACTS       = 'Contracts',       'Contracts / Supplies (3%)'
        IMPORTED_SVC    = 'Imported_Svc',    'Imported Services (20%)'

    # WHT rates per category
    WHT_RATES = {
        'None':         Decimal('0'),
        'Consultancy':  Decimal('0.05'),
        'Rent':         Decimal('0.10'),
        'Dividends':    Decimal('0.05'),
        'Contracts':    Decimal('0.03'),
        'Imported_Svc': Decimal('0.20'),
    }

    # Identification
    vendor_number   = models.CharField(max_length=20, unique=True, editable=False)
    name            = models.CharField(max_length=150)
    vendor_type     = models.CharField(max_length=20, choices=VendorType.choices,
                                        default=VendorType.SUPPLIER)
    status          = models.CharField(max_length=20, choices=Status.choices,
                                        default=Status.ACTIVE)

    # Contact details
    contact_person  = models.CharField(max_length=100, blank=True)
    email           = models.EmailField(blank=True)
    phone           = models.CharField(max_length=20, blank=True)
    address         = models.TextField(blank=True)
    city            = models.CharField(max_length=50, blank=True)
    country         = models.CharField(max_length=50, default='Kenya')
    website         = models.URLField(blank=True)

    # Tax & compliance
    kra_pin         = models.CharField(max_length=20, blank=True)
    vat_number      = models.CharField(max_length=20, blank=True)
    wht_category    = models.CharField(max_length=20, choices=WHTCategory.choices,
                                        default=WHTCategory.NONE)

    # Bank details
    bank_name       = models.CharField(max_length=100, blank=True)
    bank_branch     = models.CharField(max_length=100, blank=True)
    account_number  = models.CharField(max_length=30, blank=True)
    account_name    = models.CharField(max_length=100, blank=True)

    # Credit terms
    credit_limit    = models.DecimalField(max_digits=15, decimal_places=2, default=0,
                                          help_text='Maximum credit allowed (KES)')
    payment_terms_days = models.IntegerField(default=30,
                                             help_text='Standard payment terms in days')
    early_payment_discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0,
                                                      help_text='Early payment discount %')
    early_payment_days = models.IntegerField(default=0,
                                             help_text='Days within which early discount applies')

    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.vendor_number} — {self.name}'

    def save(self, *args, **kwargs):
        if not self.vendor_number:
            super().save(*args, **kwargs)
            self.vendor_number = f'VEN-{self.pk:05d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    @property
    def wht_rate(self):
        return self.WHT_RATES.get(self.wht_category, Decimal('0'))

    @property
    def outstanding_balance(self):
        """Total unpaid amount across all approved bills."""
        return sum(
            b.balance_due for b in self.bills.filter(
                status__in=[Bill.Status.APPROVED_FINANCE, Bill.Status.PARTIALLY_PAID]
            )
        )

    @property
    def credit_available(self):
        if self.credit_limit == 0:
            return None  # No limit set
        return self.credit_limit - self.outstanding_balance

    @property
    def is_over_credit_limit(self):
        if self.credit_limit == 0:
            return False
        return self.outstanding_balance > self.credit_limit


class Bill(models.Model):
    """
    A vendor bill (purchase invoice).
    Lifecycle: DRAFT → SUBMITTED → APPROVED_PROCUREMENT → APPROVED_FINANCE → PARTIALLY_PAID → PAID
    """
    class Status(models.TextChoices):
        DRAFT                = 'Draft',               'Draft'
        SUBMITTED            = 'Submitted',           'Submitted — Awaiting Procurement'
        APPROVED_PROCUREMENT = 'Approved_Procurement','Approved by Procurement'
        APPROVED_FINANCE     = 'Approved_Finance',    'Approved by Finance — Posted to GL'
        PARTIALLY_PAID       = 'Partially_Paid',      'Partially Paid'
        PAID                 = 'Paid',                'Fully Paid'
        REJECTED             = 'Rejected',            'Rejected'
        CANCELLED            = 'Cancelled',           'Cancelled'

    class BillType(models.TextChoices):
        INVOICE     = 'Invoice',     'Supplier Invoice'
        CREDIT_NOTE = 'Credit_Note', 'Credit Note'
        DEBIT_NOTE  = 'Debit_Note',  'Debit Note'

    # Identification
    bill_number     = models.CharField(max_length=30, unique=True, editable=False)
    vendor          = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='bills')
    bill_type       = models.CharField(max_length=15, choices=BillType.choices,
                                        default=BillType.INVOICE)
    vendor_ref      = models.CharField(max_length=50, blank=True,
                                        help_text="Vendor's own invoice number")

    # Dates
    bill_date       = models.DateField()
    due_date        = models.DateField()
    received_date   = models.DateField(default=timezone.now)

    # Amounts
    subtotal        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vat_amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    wht_amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0,
                                          help_text='Withholding tax deducted')
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount    = models.DecimalField(max_digits=15, decimal_places=2, default=0,
                                          help_text='subtotal + VAT - WHT - discount')
    amount_paid     = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Status & workflow
    status          = models.CharField(max_length=25, choices=Status.choices,
                                        default=Status.DRAFT)
    rejection_reason = models.TextField(blank=True)

    # Approval audit trail
    created_by              = models.ForeignKey('auth.User', null=True, blank=True,
                                                 on_delete=models.SET_NULL,
                                                 related_name='bills_created')
    submitted_by            = models.ForeignKey('auth.User', null=True, blank=True,
                                                 on_delete=models.SET_NULL,
                                                 related_name='bills_submitted')
    procurement_approved_by = models.ForeignKey('auth.User', null=True, blank=True,
                                                 on_delete=models.SET_NULL,
                                                 related_name='bills_procurement_approved')
    finance_approved_by     = models.ForeignKey('auth.User', null=True, blank=True,
                                                 on_delete=models.SET_NULL,
                                                 related_name='bills_finance_approved')
    rejected_by             = models.ForeignKey('auth.User', null=True, blank=True,
                                                 on_delete=models.SET_NULL,
                                                 related_name='bills_rejected')

    # Timestamps
    created_at              = models.DateTimeField(auto_now_add=True)
    submitted_at            = models.DateTimeField(null=True, blank=True)
    procurement_approved_at = models.DateTimeField(null=True, blank=True)
    finance_approved_at     = models.DateTimeField(null=True, blank=True)
    rejected_at             = models.DateTimeField(null=True, blank=True)
    paid_at                 = models.DateTimeField(null=True, blank=True)

    # GL link
    journal_entry   = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='ap_bills')
    notes           = models.TextField(blank=True)

    class Meta:
        ordering = ['-bill_date', '-created_at']

    def __str__(self):
        return f'{self.bill_number} | {self.vendor.name} | KES {self.total_amount}'

    def save(self, *args, **kwargs):
        if not self.bill_number:
            super().save(*args, **kwargs)
            self.bill_number = f'BILL-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    @property
    def balance_due(self):
        return self.total_amount - self.amount_paid

    @property
    def is_overdue(self):
        return (
            self.status in (self.Status.APPROVED_FINANCE, self.Status.PARTIALLY_PAID) and
            self.due_date < timezone.now().date()
        )

    @property
    def days_overdue(self):
        if not self.is_overdue:
            return 0
        return (timezone.now().date() - self.due_date).days

    @property
    def early_payment_discount(self):
        """Calculate early payment discount if within terms."""
        if self.vendor.early_payment_discount_pct == 0:
            return Decimal('0')
        cutoff = self.bill_date + timezone.timedelta(days=self.vendor.early_payment_days)
        if timezone.now().date() <= cutoff:
            return (self.balance_due * self.vendor.early_payment_discount_pct / 100).quantize(Decimal('0.01'))
        return Decimal('0')

    def recalculate_totals(self):
        """Recalculate bill totals from lines."""
        lines = self.lines.all()
        self.subtotal     = sum(l.line_total for l in lines)
        self.wht_amount   = (self.subtotal * self.vendor.wht_rate).quantize(Decimal('0.01'))
        self.total_amount = self.subtotal + self.vat_amount - self.wht_amount - self.discount_amount
        self.save()

    # ── Workflow transitions ──────────────────────────────────

    def submit(self, user):
        if self.status != self.Status.DRAFT:
            raise ValidationError('Only Draft bills can be submitted.')
        if not self.lines.exists():
            raise ValidationError('Add at least one line item before submitting.')
        self.status       = self.Status.SUBMITTED
        self.submitted_by = user
        self.submitted_at = timezone.now()
        self.save()

    def approve_procurement(self, user):
        if self.status != self.Status.SUBMITTED:
            raise ValidationError('Bill must be Submitted before Procurement approval.')
        self.status                  = self.Status.APPROVED_PROCUREMENT
        self.procurement_approved_by = user
        self.procurement_approved_at = timezone.now()
        self.save()

    def approve_finance(self, user):
        if self.status != self.Status.APPROVED_PROCUREMENT:
            raise ValidationError('Bill must have Procurement approval before Finance approval.')
        self.status              = self.Status.APPROVED_FINANCE
        self.finance_approved_by = user
        self.finance_approved_at = timezone.now()
        self.save()

    def reject(self, user, reason):
        if self.status not in (self.Status.SUBMITTED, self.Status.APPROVED_PROCUREMENT):
            raise ValidationError('Only Submitted or Procurement-approved bills can be rejected.')
        if not reason or not reason.strip():
            raise ValidationError('A rejection reason is required.')
        self.status           = self.Status.REJECTED
        self.rejected_by      = user
        self.rejected_at      = timezone.now()
        self.rejection_reason = reason
        self.save()


class BillLine(models.Model):
    """Individual line item on a vendor bill."""
    bill        = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='lines')
    description = models.CharField(max_length=255)
    quantity    = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price  = models.DecimalField(max_digits=15, decimal_places=2)
    vat_rate    = models.DecimalField(max_digits=5, decimal_places=2, default=0,
                                      help_text='VAT rate % (e.g. 16 for 16%)')
    gl_account  = models.ForeignKey('Finance.Account', null=True, blank=True,
                                     on_delete=models.SET_NULL,
                                     help_text='GL expense account for this line')

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.bill.bill_number} | {self.description} | KES {self.line_total}'

    @property
    def line_total(self):
        return (self.quantity * self.unit_price).quantize(Decimal('0.01'))

    @property
    def vat_amount(self):
        return (self.line_total * self.vat_rate / 100).quantize(Decimal('0.01'))


class Payment(models.Model):
    """Records a payment made to a vendor."""
    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = 'Bank Transfer', 'Bank Transfer'
        CHEQUE        = 'Cheque',        'Cheque'
        MPESA         = 'M-Pesa',        'M-Pesa'
        CASH          = 'Cash',          'Cash'

    payment_number  = models.CharField(max_length=30, unique=True, editable=False)
    vendor          = models.ForeignKey(Vendor, on_delete=models.PROTECT,
                                         related_name='payments')
    payment_date    = models.DateField()
    payment_method  = models.CharField(max_length=20, choices=PaymentMethod.choices,
                                        default=PaymentMethod.BANK_TRANSFER)
    amount          = models.DecimalField(max_digits=15, decimal_places=2)
    wht_deducted    = models.DecimalField(max_digits=15, decimal_places=2, default=0,
                                          help_text='WHT deducted at source')
    reference       = models.CharField(max_length=100, blank=True,
                                        help_text='Bank ref, cheque number, M-Pesa code')
    notes           = models.TextField(blank=True)
    journal_entry   = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='ap_payments')
    created_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f'{self.payment_number} | {self.vendor.name} | KES {self.amount}'

    def save(self, *args, **kwargs):
        if not self.payment_number:
            super().save(*args, **kwargs)
            self.payment_number = f'PAY-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)


class PaymentAllocation(models.Model):
    """Links a payment to specific bills (one payment can cover multiple bills)."""
    payment     = models.ForeignKey(Payment, on_delete=models.CASCADE,
                                     related_name='allocations')
    bill        = models.ForeignKey(Bill, on_delete=models.PROTECT,
                                     related_name='allocations')
    amount      = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        unique_together = [['payment', 'bill']]

    def __str__(self):
        return f'{self.payment.payment_number} → {self.bill.bill_number} | KES {self.amount}'
