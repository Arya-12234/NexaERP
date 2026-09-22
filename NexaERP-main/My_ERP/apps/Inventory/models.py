from django.db import models

# Create your models here.
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal


class Category(models.Model):
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    parent      = models.ForeignKey('self', null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name='children')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Warehouse(models.Model):
    class Status(models.TextChoices):
        ACTIVE   = 'Active',   'Active'
        INACTIVE = 'Inactive', 'Inactive'

    name     = models.CharField(max_length=100, unique=True)
    code     = models.CharField(max_length=10, unique=True)
    address  = models.TextField(blank=True)
    city     = models.CharField(max_length=50, blank=True)
    manager  = models.CharField(max_length=100, blank=True)
    phone    = models.CharField(max_length=20, blank=True)
    status   = models.CharField(max_length=10, choices=Status.choices,
                                 default=Status.ACTIVE)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.code} — {self.name}'

    def save(self, *args, **kwargs):
        # Only one default warehouse
        if self.is_default:
            Warehouse.objects.exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class Product(models.Model):
    class ProductType(models.TextChoices):
        GOODS   = 'Goods',   'Physical Goods'
        SERVICE = 'Service', 'Service'

    class ValuationMethod(models.TextChoices):
        WAC  = 'WAC',  'Weighted Average Cost'
        FIFO = 'FIFO', 'First In First Out'

    class Status(models.TextChoices):
        ACTIVE       = 'Active',       'Active'
        INACTIVE     = 'Inactive',     'Inactive'
        DISCONTINUED = 'Discontinued', 'Discontinued'

    class UnitOfMeasure(models.TextChoices):
        PIECE  = 'Piece',  'Piece'
        KG     = 'Kg',     'Kilogram'
        LITRE  = 'Litre',  'Litre'
        METRE  = 'Metre',  'Metre'
        BOX    = 'Box',    'Box'
        CARTON = 'Carton', 'Carton'
        HOUR   = 'Hour',   'Hour'
        MONTH  = 'Month',  'Month'

    # Identification
    sku             = models.CharField(max_length=50, unique=True)
    barcode         = models.CharField(max_length=100, blank=True, unique=True, null=True)
    name            = models.CharField(max_length=150)
    description     = models.TextField(blank=True)
    category        = models.ForeignKey(Category, on_delete=models.PROTECT,
                                         related_name='products')
    product_type    = models.CharField(max_length=10, choices=ProductType.choices,
                                        default=ProductType.GOODS)
    status          = models.CharField(max_length=15, choices=Status.choices,
                                        default=Status.ACTIVE)
    unit_of_measure = models.CharField(max_length=10, choices=UnitOfMeasure.choices,
                                        default=UnitOfMeasure.PIECE)

    # Valuation
    valuation_method = models.CharField(max_length=5, choices=ValuationMethod.choices,
                                         default=ValuationMethod.WAC)
    cost_price      = models.DecimalField(max_digits=15, decimal_places=2, default=0,
                                          help_text='Standard / average cost price (KES)')
    selling_price   = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vat_rate        = models.DecimalField(max_digits=5, decimal_places=2, default=16)

    # Stock control (for Goods only)
    track_stock     = models.BooleanField(default=True)
    reorder_point   = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                          help_text='Trigger reorder alert when stock falls below this')
    reorder_quantity= models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                          help_text='Suggested quantity to reorder')
    minimum_stock   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    maximum_stock   = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # GL accounts
    inventory_account   = models.ForeignKey('Finance.Account', null=True, blank=True,
                                             on_delete=models.SET_NULL,
                                             related_name='inventory_products',
                                             help_text='Balance sheet inventory account')
    cogs_account        = models.ForeignKey('Finance.Account', null=True, blank=True,
                                             on_delete=models.SET_NULL,
                                             related_name='cogs_products',
                                             help_text='COGS expense account')
    revenue_account     = models.ForeignKey('Finance.Account', null=True, blank=True,
                                             on_delete=models.SET_NULL,
                                             related_name='revenue_products',
                                             help_text='Sales revenue account')

    # Supplier info
    preferred_supplier  = models.CharField(max_length=150, blank=True)
    supplier_sku        = models.CharField(max_length=50, blank=True)
    lead_time_days      = models.IntegerField(default=0)

    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.sku} — {self.name}'

    @property
    def total_stock(self):
        """Total stock across all warehouses."""
        return sum(
            inv.quantity_on_hand
            for inv in self.inventory.filter(warehouse__status='Active')
        )

    @property
    def total_stock_value(self):
        return self.total_stock * self.cost_price

    @property
    def is_below_reorder_point(self):
        if not self.track_stock or self.product_type == self.ProductType.SERVICE:
            return False
        return self.reorder_point > 0 and self.total_stock <= self.reorder_point

    @property
    def is_out_of_stock(self):
        if not self.track_stock or self.product_type == self.ProductType.SERVICE:
            return False
        return self.total_stock <= 0


class WarehouseInventory(models.Model):
    """Tracks quantity on hand per product per warehouse."""
    product          = models.ForeignKey(Product, on_delete=models.CASCADE,
                                          related_name='inventory')
    warehouse        = models.ForeignKey(Warehouse, on_delete=models.CASCADE,
                                          related_name='inventory')
    quantity_on_hand = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    quantity_reserved= models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                           help_text='Reserved for orders')
    quantity_available = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    last_updated     = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [['product', 'warehouse']]

    def __str__(self):
        return f'{self.product.sku} @ {self.warehouse.code}: {self.quantity_on_hand}'

    def save(self, *args, **kwargs):
        self.quantity_available = self.quantity_on_hand - self.quantity_reserved
        super().save(*args, **kwargs)


class StockMovement(models.Model):
    """
    Records every stock transaction.
    Each movement auto-posts a GL journal entry.
    """
    class MovementType(models.TextChoices):
        RECEIPT      = 'Receipt',      'Stock Receipt (Purchase)'
        ISSUE        = 'Issue',        'Stock Issue (Sale / Consumption)'
        ADJUSTMENT   = 'Adjustment',   'Stock Adjustment'
        TRANSFER     = 'Transfer',     'Inter-Warehouse Transfer'
        RETURN       = 'Return',       'Customer Return'
        OPENING      = 'Opening',      'Opening Balance'
        WRITE_OFF    = 'Write_Off',    'Write Off (Damage / Expiry)'

    reference       = models.CharField(max_length=30, unique=True, editable=False)
    product         = models.ForeignKey(Product, on_delete=models.PROTECT,
                                         related_name='movements')
    warehouse       = models.ForeignKey(Warehouse, on_delete=models.PROTECT,
                                         related_name='movements')
    to_warehouse    = models.ForeignKey(Warehouse, null=True, blank=True,
                                         on_delete=models.PROTECT,
                                         related_name='incoming_movements',
                                         help_text='For transfers only')
    movement_type   = models.CharField(max_length=15, choices=MovementType.choices)
    quantity        = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost       = models.DecimalField(max_digits=15, decimal_places=2,
                                          help_text='Cost per unit at time of movement')
    total_cost      = models.DecimalField(max_digits=15, decimal_places=2)
    quantity_before = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    quantity_after  = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    date            = models.DateField()
    notes           = models.TextField(blank=True)
    source_ref      = models.CharField(max_length=100, blank=True,
                                        help_text='PO number, invoice number, etc.')
    journal_entry   = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='stock_movements')
    created_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'{self.reference} | {self.product.sku} | {self.movement_type} | {self.quantity}'

    def save(self, *args, **kwargs):
        if not self.reference:
            self.total_cost = (Decimal(str(self.quantity)) * Decimal(str(self.unit_cost))).quantize(Decimal('0.01'))
            super().save(*args, **kwargs)
            self.reference = f'SM-{self.pk:07d}'
            kwargs['force_insert'] = False
        self.total_cost = (Decimal(str(self.quantity)) * Decimal(str(self.unit_cost))).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)


class PurchaseOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT     = 'Draft',     'Draft'
        SUBMITTED = 'Submitted', 'Submitted — Awaiting Approval'
        APPROVED  = 'Approved',  'Approved'
        RECEIVED  = 'Received',  'Fully Received'
        PARTIAL   = 'Partial',   'Partially Received'
        CANCELLED = 'Cancelled', 'Cancelled'

    po_number       = models.CharField(max_length=30, unique=True, editable=False)
    supplier        = models.CharField(max_length=150)
    supplier_ref    = models.CharField(max_length=50, blank=True)
    warehouse       = models.ForeignKey(Warehouse, on_delete=models.PROTECT,
                                         related_name='purchase_orders')
    order_date      = models.DateField()
    expected_date   = models.DateField(null=True, blank=True)
    status          = models.CharField(max_length=10, choices=Status.choices,
                                        default=Status.DRAFT)

    subtotal        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vat_amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount    = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    notes           = models.TextField(blank=True)
    approved_by     = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='approved_pos')
    approved_at     = models.DateTimeField(null=True, blank=True)
    created_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='created_pos')
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-order_date', '-created_at']

    def __str__(self):
        return f'{self.po_number} | {self.supplier} | KES {self.total_amount}'

    def save(self, *args, **kwargs):
        if not self.po_number:
            super().save(*args, **kwargs)
            self.po_number = f'PO-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        lines           = self.lines.all()
        self.subtotal   = sum(l.line_total for l in lines)
        self.vat_amount = sum(l.vat_amount for l in lines)
        self.total_amount = self.subtotal + self.vat_amount
        self.save()


class PurchaseOrderLine(models.Model):
    po              = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE,
                                         related_name='lines')
    product         = models.ForeignKey(Product, on_delete=models.PROTECT,
                                         related_name='po_lines')
    quantity_ordered = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_received= models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_cost       = models.DecimalField(max_digits=15, decimal_places=2)
    vat_rate        = models.DecimalField(max_digits=5, decimal_places=2, default=16)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.po.po_number} | {self.product.sku} | {self.quantity_ordered}'

    @property
    def line_total(self):
        return (self.quantity_ordered * self.unit_cost).quantize(Decimal('0.01'))

    @property
    def vat_amount(self):
        return (self.line_total * self.vat_rate / 100).quantize(Decimal('0.01'))

    @property
    def quantity_pending(self):
        return self.quantity_ordered - self.quantity_received

    @property
    def is_fully_received(self):
        return self.quantity_received >= self.quantity_ordered


class StockAdjustment(models.Model):
    class AdjustmentReason(models.TextChoices):
        DAMAGE        = 'Damage',        'Damage'
        EXPIRY        = 'Expiry',        'Expiry / Spoilage'
        THEFT         = 'Theft',         'Theft / Loss'
        COUNT_VARIANCE= 'Count_Variance','Physical Count Variance'
        RETURN        = 'Return',        'Supplier Return'
        OTHER         = 'Other',         'Other'

    reference   = models.CharField(max_length=30, unique=True, editable=False)
    product     = models.ForeignKey(Product, on_delete=models.PROTECT,
                                     related_name='adjustments')
    warehouse   = models.ForeignKey(Warehouse, on_delete=models.PROTECT,
                                     related_name='adjustments')
    reason      = models.CharField(max_length=20, choices=AdjustmentReason.choices)
    quantity_before = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_after  = models.DecimalField(max_digits=12, decimal_places=2)
    adjustment_qty  = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost       = models.DecimalField(max_digits=15, decimal_places=2)
    total_cost      = models.DecimalField(max_digits=15, decimal_places=2)
    date            = models.DateField()
    notes           = models.TextField(blank=True)
    journal_entry   = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='stock_adjustments')
    created_by      = models.ForeignKey('auth.User', null=True, blank=True,
                                         on_delete=models.SET_NULL)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'{self.reference} | {self.product.sku} | {self.reason}'

    def save(self, *args, **kwargs):
        if not self.reference:
            super().save(*args, **kwargs)
            self.reference = f'ADJ-{self.pk:06d}'
            kwargs['force_insert'] = False
        self.adjustment_qty = self.quantity_after - self.quantity_before
        self.total_cost = abs(self.adjustment_qty * self.unit_cost)
        super().save(*args, **kwargs)


class FIFOLayer(models.Model):
    """
    Tracks individual purchase lots for FIFO valuation.
    Each receipt creates a new layer; issues consume from oldest first.
    """
    product         = models.ForeignKey(Product, on_delete=models.CASCADE,
                                         related_name='fifo_layers')
    warehouse       = models.ForeignKey(Warehouse, on_delete=models.CASCADE,
                                         related_name='fifo_layers')
    receipt_date    = models.DateField()
    quantity_in     = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_remaining = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost       = models.DecimalField(max_digits=15, decimal_places=2)
    source_ref      = models.CharField(max_length=100, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['receipt_date', 'created_at']

    def __str__(self):
        return f'{self.product.sku} @ {self.unit_cost} | Remaining: {self.quantity_remaining}'