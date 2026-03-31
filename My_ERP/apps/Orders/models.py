from django.db import models

# Create your models here.
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal


class Quotation(models.Model):
    """
    Pro-forma / Quotation before a Sales Order is confirmed.
    Can be converted to a Sales Order.
    """
    class Status(models.TextChoices):
        DRAFT     = 'Draft',     'Draft'
        SENT      = 'Sent',      'Sent to Customer'
        ACCEPTED  = 'Accepted',  'Accepted — Converted to Order'
        REJECTED  = 'Rejected',  'Rejected'
        EXPIRED   = 'Expired',   'Expired'

    quotation_number = models.CharField(max_length=30, unique=True, editable=False)
    customer         = models.CharField(max_length=150)
    customer_email   = models.EmailField(blank=True)
    customer_phone   = models.CharField(max_length=20, blank=True)
    date             = models.DateField()
    valid_until      = models.DateField()
    status           = models.CharField(max_length=10, choices=Status.choices,
                                         default=Status.DRAFT)
    subtotal         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vat_amount       = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    discount_amount  = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes            = models.TextField(blank=True)
    terms            = models.TextField(blank=True)
    created_by       = models.ForeignKey('auth.User', null=True, blank=True,
                                          on_delete=models.SET_NULL,
                                          related_name='quotations_created')
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'{self.quotation_number} | {self.customer} | KES {self.total_amount}'

    def save(self, *args, **kwargs):
        if not self.quotation_number:
            super().save(*args, **kwargs)
            self.quotation_number = f'QT-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        lines            = self.lines.all()
        self.subtotal    = sum(l.line_total for l in lines)
        self.vat_amount  = sum(l.vat_amount for l in lines)
        self.total_amount = self.subtotal + self.vat_amount - self.discount_amount
        self.save()

    @property
    def is_expired(self):
        return self.valid_until < timezone.now().date() and self.status == self.Status.SENT


class QuotationLine(models.Model):
    quotation   = models.ForeignKey(Quotation, on_delete=models.CASCADE,
                                     related_name='lines')
    description = models.CharField(max_length=255)
    quantity    = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price  = models.DecimalField(max_digits=15, decimal_places=2)
    vat_rate    = models.DecimalField(max_digits=5, decimal_places=2, default=16)
    product     = models.ForeignKey('Inventory.Product', null=True, blank=True,
                                     on_delete=models.SET_NULL,
                                     related_name='quotation_lines')

    class Meta:
        ordering = ['id']

    @property
    def line_total(self):
        return (self.quantity * self.unit_price).quantize(Decimal('0.01'))

    @property
    def vat_amount(self):
        return (self.line_total * self.vat_rate / 100).quantize(Decimal('0.01'))

    def __str__(self):
        return f'{self.quotation.quotation_number} | {self.description}'


class SalesOrder(models.Model):
    """
    Sales Order — confirmed customer order.
    Lifecycle: Pending → Confirmed → Approved → Processing → Shipped → Delivered
    """
    class Status(models.TextChoices):
        PENDING    = 'Pending',    'Pending — Awaiting Confirmation'
        CONFIRMED  = 'Confirmed',  'Confirmed'
        APPROVED   = 'Approved',   'Approved — Ready to Process'
        PROCESSING = 'Processing', 'Processing — Picking & Packing'
        SHIPPED    = 'Shipped',    'Shipped'
        DELIVERED  = 'Delivered',  'Delivered'
        CANCELLED  = 'Cancelled',  'Cancelled'
        RETURNED   = 'Returned',   'Returned'

    class PaymentStatus(models.TextChoices):
        UNPAID         = 'Unpaid',         'Unpaid'
        PARTIALLY_PAID = 'Partially_Paid', 'Partially Paid'
        PAID           = 'Paid',           'Fully Paid'

    # Identification
    order_number    = models.CharField(max_length=30, unique=True, editable=False)
    quotation       = models.OneToOneField(Quotation, null=True, blank=True,
                                            on_delete=models.SET_NULL,
                                            related_name='sales_order')

    # Customer info
    customer        = models.CharField(max_length=150)
    customer_email  = models.EmailField(blank=True)
    customer_phone  = models.CharField(max_length=20, blank=True)
    customer_address= models.TextField(blank=True)

    # AR link
    ar_customer     = models.ForeignKey('AR.Customer', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='sales_orders')
    ar_invoice      = models.ForeignKey('AR.Invoice', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='sales_orders')

    # Dates
    order_date      = models.DateField()
    requested_date  = models.DateField(null=True, blank=True,
                                        help_text='Customer requested delivery date')
    confirmed_date  = models.DateField(null=True, blank=True)

    # Amounts
    subtotal        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vat_amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount    = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Status
    status          = models.CharField(max_length=15, choices=Status.choices,
                                        default=Status.PENDING)
    payment_status  = models.CharField(max_length=15, choices=PaymentStatus.choices,
                                        default=PaymentStatus.UNPAID)
    rejection_reason= models.TextField(blank=True)
    notes           = models.TextField(blank=True)
    internal_notes  = models.TextField(blank=True)

    # Warehouse
    warehouse       = models.ForeignKey('Inventory.Warehouse', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='sales_orders')

    # Audit
    created_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='sales_orders_created')
    approved_by     = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='sales_orders_approved')
    created_at      = models.DateTimeField(auto_now_add=True)
    approved_at     = models.DateTimeField(null=True, blank=True)
    shipped_at      = models.DateTimeField(null=True, blank=True)
    delivered_at    = models.DateTimeField(null=True, blank=True)

    # GL
    journal_entry   = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='sales_orders')

    class Meta:
        ordering = ['-order_date', '-created_at']

    def __str__(self):
        return f'{self.order_number} | {self.customer} | {self.status}'

    def save(self, *args, **kwargs):
        if not self.order_number:
            super().save(*args, **kwargs)
            self.order_number = f'SO-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        lines             = self.lines.all()
        self.subtotal     = sum(l.line_total for l in lines)
        self.vat_amount   = sum(l.vat_amount for l in lines)
        self.total_amount = self.subtotal + self.vat_amount - self.discount_amount
        self.save()

    @property
    def balance_due(self):
        if self.ar_invoice:
            return self.ar_invoice.balance_due
        return self.total_amount


class SalesOrderLine(models.Model):
    order       = models.ForeignKey(SalesOrder, on_delete=models.CASCADE,
                                     related_name='lines')
    product     = models.ForeignKey('Inventory.Product', null=True, blank=True,
                                     on_delete=models.SET_NULL,
                                     related_name='sales_order_lines')
    description = models.CharField(max_length=255)
    quantity    = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price  = models.DecimalField(max_digits=15, decimal_places=2)
    vat_rate    = models.DecimalField(max_digits=5, decimal_places=2, default=16)
    quantity_delivered = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        ordering = ['id']

    @property
    def line_total(self):
        return (self.quantity * self.unit_price).quantize(Decimal('0.01'))

    @property
    def vat_amount(self):
        return (self.line_total * self.vat_rate / 100).quantize(Decimal('0.01'))

    @property
    def quantity_pending(self):
        return self.quantity - self.quantity_delivered

    @property
    def is_fully_delivered(self):
        return self.quantity_delivered >= self.quantity

    def __str__(self):
        return f'{self.order.order_number} | {self.description}'


class PurchaseOrder(models.Model):
    """
    Purchase Order — order raised to a supplier.
    Separate from Inventory PO — this is the commercial document.
    Lifecycle: Draft → Submitted → Approved → Sent → Received → Closed
    """
    class Status(models.TextChoices):
        DRAFT     = 'Draft',     'Draft'
        SUBMITTED = 'Submitted', 'Submitted — Awaiting Approval'
        APPROVED  = 'Approved',  'Approved'
        SENT      = 'Sent',      'Sent to Supplier'
        RECEIVED  = 'Received',  'Fully Received'
        PARTIAL   = 'Partial',   'Partially Received'
        CLOSED    = 'Closed',    'Closed'
        CANCELLED = 'Cancelled', 'Cancelled'

    order_number    = models.CharField(max_length=30, unique=True, editable=False)

    # Supplier info
    supplier        = models.CharField(max_length=150)
    supplier_email  = models.EmailField(blank=True)
    supplier_phone  = models.CharField(max_length=20, blank=True)
    supplier_ref    = models.CharField(max_length=50, blank=True)

    # AP link
    ap_vendor       = models.ForeignKey('AP.Vendor', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='purchase_orders')
    ap_bill         = models.ForeignKey('AP.Bill', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='purchase_orders')

    # Inventory warehouse
    warehouse       = models.ForeignKey('Inventory.Warehouse', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='commercial_purchase_orders')

    # Dates
    order_date      = models.DateField()
    expected_date   = models.DateField(null=True, blank=True)
    received_date   = models.DateField(null=True, blank=True)

    # Amounts
    subtotal        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vat_amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount    = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Status
    status          = models.CharField(max_length=10, choices=Status.choices,
                                        default=Status.DRAFT)
    rejection_reason= models.TextField(blank=True)
    notes           = models.TextField(blank=True)
    terms           = models.TextField(blank=True)

    # Audit
    created_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='purchase_orders_created')
    approved_by     = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='purchase_orders_approved')
    created_at      = models.DateTimeField(auto_now_add=True)
    approved_at     = models.DateTimeField(null=True, blank=True)
    sent_at         = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-order_date', '-created_at']

    def __str__(self):
        return f'{self.order_number} | {self.supplier} | {self.status}'

    def save(self, *args, **kwargs):
        if not self.order_number:
            super().save(*args, **kwargs)
            self.order_number = f'PO-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        lines             = self.lines.all()
        self.subtotal     = sum(l.line_total for l in lines)
        self.vat_amount   = sum(l.vat_amount for l in lines)
        self.total_amount = self.subtotal + self.vat_amount - self.discount_amount
        self.save()


class PurchaseOrderLine(models.Model):
    order       = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE,
                                     related_name='lines')
    product     = models.ForeignKey('Inventory.Product', null=True, blank=True,
                                     on_delete=models.SET_NULL,
                                     related_name='purchase_order_lines')
    description = models.CharField(max_length=255)
    quantity    = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_cost   = models.DecimalField(max_digits=15, decimal_places=2)
    vat_rate    = models.DecimalField(max_digits=5, decimal_places=2, default=16)
    quantity_received = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        ordering = ['id']

    @property
    def line_total(self):
        return (self.quantity * self.unit_cost).quantize(Decimal('0.01'))

    @property
    def vat_amount(self):
        return (self.line_total * self.vat_rate / 100).quantize(Decimal('0.01'))

    @property
    def quantity_pending(self):
        return self.quantity - self.quantity_received

    @property
    def is_fully_received(self):
        return self.quantity_received >= self.quantity

    def __str__(self):
        return f'{self.order.order_number} | {self.description}'


class Delivery(models.Model):
    """Tracks physical delivery of a Sales Order."""
    class Status(models.TextChoices):
        PENDING   = 'Pending',   'Pending'
        DISPATCHED= 'Dispatched','Dispatched'
        IN_TRANSIT= 'In_Transit','In Transit'
        DELIVERED = 'Delivered', 'Delivered'
        FAILED    = 'Failed',    'Delivery Failed'
        RETURNED  = 'Returned',  'Returned'

    delivery_number = models.CharField(max_length=30, unique=True, editable=False)
    sales_order     = models.ForeignKey(SalesOrder, on_delete=models.PROTECT,
                                         related_name='deliveries')
    status          = models.CharField(max_length=15, choices=Status.choices,
                                        default=Status.PENDING)

    # Delivery details
    delivery_address= models.TextField(blank=True)
    carrier         = models.CharField(max_length=100, blank=True)
    tracking_number = models.CharField(max_length=100, blank=True)
    driver_name     = models.CharField(max_length=100, blank=True)
    driver_phone    = models.CharField(max_length=20, blank=True)
    vehicle_number  = models.CharField(max_length=20, blank=True)

    # Dates
    scheduled_date  = models.DateField(null=True, blank=True)
    dispatched_at   = models.DateTimeField(null=True, blank=True)
    delivered_at    = models.DateTimeField(null=True, blank=True)

    notes           = models.TextField(blank=True)
    created_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.delivery_number} | {self.sales_order.order_number} | {self.status}'

    def save(self, *args, **kwargs):
        if not self.delivery_number:
            super().save(*args, **kwargs)
            self.delivery_number = f'DEL-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)


class DeliveryLine(models.Model):
    delivery    = models.ForeignKey(Delivery, on_delete=models.CASCADE,
                                     related_name='lines')
    order_line  = models.ForeignKey(SalesOrderLine, on_delete=models.PROTECT,
                                     related_name='delivery_lines')
    quantity    = models.DecimalField(max_digits=10, decimal_places=2)
    notes       = models.TextField(blank=True)

    def __str__(self):
        return f'{self.delivery.delivery_number} | {self.order_line.description} | {self.quantity}'