from django.db import models

# Create your models here.
from django.db import models
from django.utils import timezone
from decimal import Decimal


class Supplier(models.Model):
    class Status(models.TextChoices):
        ACTIVE      = 'Active',      'Active'
        INACTIVE    = 'Inactive',    'Inactive'
        BLACKLISTED = 'Blacklisted', 'Blacklisted'
        PENDING     = 'Pending',     'Pending Approval'

    class SupplierType(models.TextChoices):
        MANUFACTURER = 'Manufacturer', 'Manufacturer'
        DISTRIBUTOR  = 'Distributor',  'Distributor'
        WHOLESALER   = 'Wholesaler',   'Wholesaler'
        RETAILER     = 'Retailer',     'Retailer'
        SERVICE      = 'Service',      'Service Provider'
        CONTRACTOR   = 'Contractor',   'Contractor'

    # Identification
    supplier_number  = models.CharField(max_length=20, unique=True, editable=False)
    name             = models.CharField(max_length=150)
    supplier_type    = models.CharField(max_length=15, choices=SupplierType.choices,
                                         default=SupplierType.DISTRIBUTOR)
    status           = models.CharField(max_length=15, choices=Status.choices,
                                         default=Status.ACTIVE)

    # Contact
    contact_person   = models.CharField(max_length=100, blank=True)
    email            = models.EmailField(blank=True)
    phone            = models.CharField(max_length=20, blank=True)
    address          = models.TextField(blank=True)
    city             = models.CharField(max_length=50, blank=True)
    country          = models.CharField(max_length=50, default='Kenya')
    website          = models.URLField(blank=True)

    # Tax
    kra_pin          = models.CharField(max_length=20, blank=True)
    vat_number       = models.CharField(max_length=20, blank=True)

    # Bank
    bank_name        = models.CharField(max_length=100, blank=True)
    account_number   = models.CharField(max_length=30, blank=True)
    account_name     = models.CharField(max_length=100, blank=True)

    # Terms
    payment_terms_days   = models.IntegerField(default=30)
    credit_limit         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    currency             = models.CharField(max_length=5, default='KES')
    lead_time_days       = models.IntegerField(default=7)
    minimum_order_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Categories supplied
    categories_supplied  = models.TextField(blank=True,
                                             help_text='Comma-separated product categories')
    notes                = models.TextField(blank=True)

    # Metrics (auto-updated)
    total_orders         = models.IntegerField(default=0)
    total_spend          = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    average_rating       = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    on_time_delivery_pct = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.supplier_number} — {self.name}'

    def save(self, *args, **kwargs):
        if not self.supplier_number:
            super().save(*args, **kwargs)
            self.supplier_number = f'SUP-{self.pk:05d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)


class PurchaseRequisition(models.Model):
    class Status(models.TextChoices):
        DRAFT      = 'Draft',      'Draft'
        SUBMITTED  = 'Submitted',  'Submitted — Awaiting Approval'
        APPROVED   = 'Approved',   'Approved'
        REJECTED   = 'Rejected',   'Rejected'
        CONVERTED  = 'Converted',  'Converted to PO'
        CLOSED     = 'Closed',     'Closed'

    class Priority(models.TextChoices):
        LOW    = 'Low',    'Low'
        MEDIUM = 'Medium', 'Medium'
        HIGH   = 'High',   'High'
        URGENT = 'Urgent', 'Urgent'

    pr_number        = models.CharField(max_length=30, unique=True, editable=False)
    title            = models.CharField(max_length=200)
    department       = models.CharField(max_length=100, blank=True)
    requested_by     = models.CharField(max_length=100, blank=True)
    priority         = models.CharField(max_length=10, choices=Priority.choices,
                                         default=Priority.MEDIUM)
    status           = models.CharField(max_length=10, choices=Status.choices,
                                         default=Status.DRAFT)

    date_required    = models.DateField(null=True, blank=True)
    preferred_supplier = models.ForeignKey(Supplier, null=True, blank=True,
                                            on_delete=models.SET_NULL,
                                            related_name='requisitions')

    subtotal         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount     = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    justification    = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    notes            = models.TextField(blank=True)

    created_by       = models.ForeignKey('auth.User', null=True, blank=True,
                                          on_delete=models.SET_NULL,
                                          related_name='requisitions_created')
    approved_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                          on_delete=models.SET_NULL,
                                          related_name='requisitions_approved')
    created_at       = models.DateTimeField(auto_now_add=True)
    submitted_at     = models.DateTimeField(null=True, blank=True)
    approved_at      = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.pr_number} — {self.title}'

    def save(self, *args, **kwargs):
        if not self.pr_number:
            super().save(*args, **kwargs)
            self.pr_number = f'PR-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        lines            = self.lines.all()
        self.subtotal    = sum(l.estimated_total for l in lines)
        self.total_amount = self.subtotal
        self.save()


class RequisitionLine(models.Model):
    requisition      = models.ForeignKey(PurchaseRequisition, on_delete=models.CASCADE,
                                          related_name='lines')
    product          = models.ForeignKey('Inventory.Product', null=True, blank=True,
                                          on_delete=models.SET_NULL)
    description      = models.CharField(max_length=255)
    quantity         = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_of_measure  = models.CharField(max_length=20, blank=True)
    estimated_price  = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes            = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    @property
    def estimated_total(self):
        return (self.quantity * self.estimated_price).quantize(Decimal('0.01'))

    def __str__(self):
        return f'{self.requisition.pr_number} | {self.description}'


class PurchaseBudget(models.Model):
    class Period(models.TextChoices):
        MONTHLY   = 'Monthly',   'Monthly'
        QUARTERLY = 'Quarterly', 'Quarterly'
        ANNUAL    = 'Annual',    'Annual'

    department    = models.CharField(max_length=100)
    category      = models.CharField(max_length=100, blank=True)
    period        = models.CharField(max_length=10, choices=Period.choices,
                                      default=Period.MONTHLY)
    year          = models.IntegerField()
    month         = models.IntegerField(null=True, blank=True,
                                         help_text='1-12 for monthly budgets')
    quarter       = models.IntegerField(null=True, blank=True,
                                         help_text='1-4 for quarterly budgets')
    budget_amount = models.DecimalField(max_digits=15, decimal_places=2)
    spent_amount  = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes         = models.TextField(blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-year', '-month']

    def __str__(self):
        return f'{self.department} — {self.period} {self.year} | Budget: KES {self.budget_amount}'

    @property
    def remaining(self):
        return self.budget_amount - self.spent_amount

    @property
    def utilization_pct(self):
        if self.budget_amount == 0:
            return 0
        return round(float(self.spent_amount) / float(self.budget_amount) * 100, 1)

    @property
    def is_over_budget(self):
        return self.spent_amount > self.budget_amount


class GoodsReceivedNote(models.Model):
    class Status(models.TextChoices):
        DRAFT     = 'Draft',     'Draft'
        CONFIRMED = 'Confirmed', 'Confirmed'
        POSTED    = 'Posted',    'Posted to Inventory'

    grn_number       = models.CharField(max_length=30, unique=True, editable=False)
    supplier         = models.ForeignKey(Supplier, on_delete=models.PROTECT,
                                          related_name='grns')
    po_reference     = models.CharField(max_length=50, blank=True,
                                         help_text='Purchase Order reference number')
    warehouse        = models.ForeignKey('Inventory.Warehouse', null=True, blank=True,
                                          on_delete=models.SET_NULL,
                                          related_name='grns')
    received_date    = models.DateField()
    status           = models.CharField(max_length=10, choices=Status.choices,
                                         default=Status.DRAFT)

    delivery_note_no = models.CharField(max_length=50, blank=True)
    vehicle_number   = models.CharField(max_length=20, blank=True)
    driver_name      = models.CharField(max_length=100, blank=True)

    total_items      = models.IntegerField(default=0)
    total_value      = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    condition_notes  = models.TextField(blank=True,
                                         help_text='Notes on condition of received goods')
    notes            = models.TextField(blank=True)

    received_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                          on_delete=models.SET_NULL,
                                          related_name='grns_received')
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-received_date', '-created_at']

    def __str__(self):
        return f'{self.grn_number} | {self.supplier.name} | {self.received_date}'

    def save(self, *args, **kwargs):
        if not self.grn_number:
            super().save(*args, **kwargs)
            self.grn_number = f'GRN-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)


class GRNLine(models.Model):
    grn              = models.ForeignKey(GoodsReceivedNote, on_delete=models.CASCADE,
                                          related_name='lines')
    product          = models.ForeignKey('Inventory.Product', null=True, blank=True,
                                          on_delete=models.SET_NULL)
    description      = models.CharField(max_length=255)
    quantity_ordered = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity_received= models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost        = models.DecimalField(max_digits=15, decimal_places=2)
    condition        = models.CharField(max_length=20, default='Good',
                                         choices=[('Good','Good'),('Damaged','Damaged'),('Rejected','Rejected')])
    notes            = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    @property
    def line_total(self):
        return (self.quantity_received * self.unit_cost).quantize(Decimal('0.01'))

    @property
    def quantity_variance(self):
        return self.quantity_received - self.quantity_ordered

    def __str__(self):
        return f'{self.grn.grn_number} | {self.description}'


class SupplierRating(models.Model):
    supplier         = models.ForeignKey(Supplier, on_delete=models.CASCADE,
                                          related_name='ratings')
    grn              = models.ForeignKey(GoodsReceivedNote, null=True, blank=True,
                                          on_delete=models.SET_NULL,
                                          related_name='ratings')
    po_reference     = models.CharField(max_length=50, blank=True)
    date             = models.DateField()

    # Ratings 1-5
    quality_rating      = models.IntegerField(default=3,
                                               help_text='Product quality 1-5')
    delivery_rating     = models.IntegerField(default=3,
                                               help_text='On-time delivery 1-5')
    pricing_rating      = models.IntegerField(default=3,
                                               help_text='Value for money 1-5')
    communication_rating= models.IntegerField(default=3,
                                               help_text='Communication & responsiveness 1-5')
    overall_rating      = models.DecimalField(max_digits=3, decimal_places=1, default=3)

    on_time_delivery    = models.BooleanField(default=True)
    comments            = models.TextField(blank=True)

    rated_by            = models.ForeignKey('auth.User', null=True, blank=True,
                                             on_delete=models.SET_NULL)
    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f'{self.supplier.name} | {self.date} | {self.overall_rating}★'

    def save(self, *args, **kwargs):
        self.overall_rating = round(
            (self.quality_rating + self.delivery_rating +
             self.pricing_rating + self.communication_rating) / 4, 1
        )
        super().save(*args, **kwargs)
        # Update supplier average rating
        ratings = self.supplier.ratings.all()
        if ratings.exists():
            avg = sum(r.overall_rating for r in ratings) / ratings.count()
            on_time = ratings.filter(on_time_delivery=True).count()
            self.supplier.average_rating       = round(avg, 1)
            self.supplier.on_time_delivery_pct = round(on_time / ratings.count() * 100, 1)
            self.supplier.save()