from django.db import models

# Create your models here.
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal


class Customer(models.Model):
    class CustomerType(models.TextChoices):
        CORPORATE   = 'Corporate',   'Corporate'
        SME         = 'SME',         'SME'
        INDIVIDUAL  = 'Individual',  'Individual'
        GOVERNMENT  = 'Government',  'Government'
        NGO         = 'NGO',         'NGO'

    class Status(models.TextChoices):
        ACTIVE      = 'Active',      'Active'
        INACTIVE    = 'Inactive',    'Inactive'
        BLACKLISTED = 'Blacklisted', 'Blacklisted'

    class WHTCategory(models.TextChoices):
        NONE         = 'None',        'None (No WHT)'
        CONSULTANCY  = 'Consultancy', 'Consultancy (5%)'
        RENT         = 'Rent',        'Rent (10%)'
        CONTRACTS    = 'Contracts',   'Contracts / Supplies (3%)'

    WHT_RATES = {
        'None':        Decimal('0'),
        'Consultancy': Decimal('0.05'),
        'Rent':        Decimal('0.10'),
        'Contracts':   Decimal('0.03'),
    }

    # Identification
    customer_number = models.CharField(max_length=20, unique=True, editable=False)
    name            = models.CharField(max_length=150)
    customer_type   = models.CharField(max_length=20, choices=CustomerType.choices,
                                        default=CustomerType.CORPORATE)
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

    # Credit terms
    credit_limit         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    payment_terms_days   = models.IntegerField(default=30)
    early_payment_discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    early_payment_days   = models.IntegerField(default=0)

    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.customer_number} — {self.name}'

    def save(self, *args, **kwargs):
        if not self.customer_number:
            super().save(*args, **kwargs)
            self.customer_number = f'CUS-{self.pk:05d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    @property
    def wht_rate(self):
        return self.WHT_RATES.get(self.wht_category, Decimal('0'))

    @property
    def outstanding_balance(self):
        return sum(
            i.balance_due for i in self.invoices.filter(
                status__in=[
                    Invoice.Status.APPROVED,
                    Invoice.Status.SENT,
                    Invoice.Status.PARTIALLY_COLLECTED,
                ]
            )
        )

    @property
    def credit_available(self):
        if self.credit_limit == 0:
            return None
        return self.credit_limit - self.outstanding_balance

    @property
    def is_over_credit_limit(self):
        if self.credit_limit == 0:
            return False
        return self.outstanding_balance > self.credit_limit


class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT               = 'Draft',               'Draft'
        APPROVED            = 'Approved',            'Approved — Posted to GL'
        SENT                = 'Sent',                'Sent to Customer'
        PARTIALLY_COLLECTED = 'Partially_Collected', 'Partially Collected'
        COLLECTED           = 'Collected',           'Fully Collected'
        CANCELLED           = 'Cancelled',           'Cancelled'
        OVERDUE             = 'Overdue',             'Overdue'

    class InvoiceType(models.TextChoices):
        INVOICE   = 'Invoice',   'Tax Invoice'
        PROFORMA  = 'Proforma',  'Proforma Invoice'
        RECURRING = 'Recurring', 'Recurring Invoice'
        CREDIT_NOTE = 'Credit_Note', 'Credit Note'

    # Identification
    invoice_number  = models.CharField(max_length=30, unique=True, editable=False)
    customer        = models.ForeignKey(Customer, on_delete=models.PROTECT,
                                         related_name='invoices')
    invoice_type    = models.CharField(max_length=15, choices=InvoiceType.choices,
                                        default=InvoiceType.INVOICE)
    our_ref         = models.CharField(max_length=50, blank=True,
                                        help_text='Internal reference / PO number')

    # Dates
    invoice_date    = models.DateField()
    due_date        = models.DateField()
    service_period_start = models.DateField(null=True, blank=True)
    service_period_end   = models.DateField(null=True, blank=True)

    # Amounts
    subtotal        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vat_amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    wht_amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount    = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount_collected= models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Recurring config
    is_recurring        = models.BooleanField(default=False)
    recurrence_interval = models.CharField(max_length=20, blank=True,
                                            help_text='Monthly, Quarterly, Annually')
    next_invoice_date   = models.DateField(null=True, blank=True)

    # Status & workflow
    status          = models.CharField(max_length=25, choices=Status.choices,
                                        default=Status.DRAFT)
    notes           = models.TextField(blank=True)

    # Audit trail
    created_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='invoices_created')
    approved_by     = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='invoices_approved')

    # Timestamps
    created_at      = models.DateTimeField(auto_now_add=True)
    approved_at     = models.DateTimeField(null=True, blank=True)
    sent_at         = models.DateTimeField(null=True, blank=True)
    collected_at    = models.DateTimeField(null=True, blank=True)

    # GL link
    journal_entry   = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='ar_invoices')

    class Meta:
        ordering = ['-invoice_date', '-created_at']

    def __str__(self):
        return f'{self.invoice_number} | {self.customer.name} | KES {self.total_amount}'

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            prefix = 'PRO' if self.invoice_type == self.InvoiceType.PROFORMA else 'INV'
            super().save(*args, **kwargs)
            self.invoice_number = f'{prefix}-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    @property
    def balance_due(self):
        return self.total_amount - self.amount_collected

    @property
    def is_overdue(self):
        return (
            self.status in (
                self.Status.APPROVED,
                self.Status.SENT,
                self.Status.PARTIALLY_COLLECTED,
            ) and self.due_date < timezone.now().date()
        )

    @property
    def days_overdue(self):
        if not self.is_overdue:
            return 0
        return (timezone.now().date() - self.due_date).days

    @property
    def early_payment_discount(self):
        if self.customer.early_payment_discount_pct == 0:
            return Decimal('0')
        cutoff = self.invoice_date + timezone.timedelta(
            days=self.customer.early_payment_days
        )
        if timezone.now().date() <= cutoff:
            return (
                self.balance_due *
                self.customer.early_payment_discount_pct / 100
            ).quantize(Decimal('0.01'))
        return Decimal('0')

    def recalculate_totals(self):
        lines           = self.lines.all()
        self.subtotal   = sum(l.line_total for l in lines)
        self.vat_amount = sum(l.vat_amount for l in lines)
        self.wht_amount = (
            self.subtotal * self.customer.wht_rate
        ).quantize(Decimal('0.01'))
        self.total_amount = (
            self.subtotal + self.vat_amount -
            self.wht_amount - self.discount_amount
        )
        self.save()


class InvoiceLine(models.Model):
    invoice     = models.ForeignKey(Invoice, on_delete=models.CASCADE,
                                     related_name='lines')
    description = models.CharField(max_length=255)
    quantity    = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price  = models.DecimalField(max_digits=15, decimal_places=2)
    vat_rate    = models.DecimalField(max_digits=5, decimal_places=2, default=16,
                                      help_text='VAT rate % (default 16%)')
    gl_account  = models.ForeignKey('Finance.Account', null=True, blank=True,
                                     on_delete=models.SET_NULL)

    class Meta:
        ordering = ['id']

    @property
    def line_total(self):
        return (self.quantity * self.unit_price).quantize(Decimal('0.01'))

    @property
    def vat_amount(self):
        return (self.line_total * self.vat_rate / 100).quantize(Decimal('0.01'))

    def __str__(self):
        return f'{self.invoice.invoice_number} | {self.description} | KES {self.line_total}'


class Receipt(models.Model):
    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = 'Bank Transfer', 'Bank Transfer'
        CHEQUE        = 'Cheque',        'Cheque'
        MPESA         = 'M-Pesa',        'M-Pesa'
        CASH          = 'Cash',          'Cash'

    receipt_number  = models.CharField(max_length=30, unique=True, editable=False)
    customer        = models.ForeignKey(Customer, on_delete=models.PROTECT,
                                         related_name='receipts')
    receipt_date    = models.DateField()
    payment_method  = models.CharField(max_length=20, choices=PaymentMethod.choices,
                                        default=PaymentMethod.BANK_TRANSFER)
    amount          = models.DecimalField(max_digits=15, decimal_places=2)
    wht_deducted    = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    reference       = models.CharField(max_length=100, blank=True)
    notes           = models.TextField(blank=True)
    journal_entry   = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='ar_receipts')
    created_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-receipt_date', '-created_at']

    def __str__(self):
        return f'{self.receipt_number} | {self.customer.name} | KES {self.amount}'

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            super().save(*args, **kwargs)
            self.receipt_number = f'REC-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)


class ReceiptAllocation(models.Model):
    receipt     = models.ForeignKey(Receipt, on_delete=models.CASCADE,
                                     related_name='allocations')
    invoice     = models.ForeignKey(Invoice, on_delete=models.PROTECT,
                                     related_name='allocations')
    amount      = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        unique_together = [['receipt', 'invoice']]

    def __str__(self):
        return f'{self.receipt.receipt_number} → {self.invoice.invoice_number} | KES {self.amount}'


class CreditNote(models.Model):
    credit_note_number = models.CharField(max_length=30, unique=True, editable=False)
    invoice            = models.ForeignKey(Invoice, on_delete=models.PROTECT,
                                            related_name='credit_notes')
    customer           = models.ForeignKey(Customer, on_delete=models.PROTECT,
                                            related_name='credit_notes')
    date               = models.DateField()
    amount             = models.DecimalField(max_digits=15, decimal_places=2)
    reason             = models.TextField()
    journal_entry      = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                            on_delete=models.SET_NULL,
                                            related_name='credit_notes')
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f'{self.credit_note_number} | {self.customer.name} | KES {self.amount}'

    def save(self, *args, **kwargs):
        if not self.credit_note_number:
            super().save(*args, **kwargs)
            self.credit_note_number = f'CN-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)