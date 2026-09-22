from django.db import models

# Create your models here.
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal


class AssetCategory(models.Model):
    """
    Asset categories with default depreciation settings.
    e.g. Computers (DBM, 33%), Vehicles (DBM, 25%), Furniture (SLM, 10 years)
    """
    class DepreciationMethod(models.TextChoices):
        SLM = 'SLM', 'Straight-Line Method'
        DBM = 'DBM', 'Declining Balance Method'

    name                  = models.CharField(max_length=100, unique=True)
    description           = models.TextField(blank=True)
    depreciation_method   = models.CharField(max_length=5, choices=DepreciationMethod.choices,
                                              default=DepreciationMethod.SLM)
    default_useful_life_months = models.IntegerField(default=60,
                                  help_text='Default useful life in months')
    default_depreciation_rate  = models.DecimalField(max_digits=5, decimal_places=4, default=0,
                                  help_text='Annual rate for DBM (e.g. 0.25 for 25%)')
    gl_asset_account      = models.ForeignKey('Finance.Account', null=True, blank=True,
                                               on_delete=models.SET_NULL,
                                               related_name='asset_categories_asset',
                                               help_text='Fixed Assets GL account')
    gl_depreciation_account = models.ForeignKey('Finance.Account', null=True, blank=True,
                                                 on_delete=models.SET_NULL,
                                                 related_name='asset_categories_depreciation',
                                                 help_text='Depreciation Expense GL account')
    gl_accumulated_account  = models.ForeignKey('Finance.Account', null=True, blank=True,
                                                 on_delete=models.SET_NULL,
                                                 related_name='asset_categories_accumulated',
                                                 help_text='Accumulated Depreciation GL account')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering    = ['name']
        verbose_name_plural = 'Asset Categories'

    def __str__(self):
        return self.name


class Asset(models.Model):
    class Status(models.TextChoices):
        ACTIVE      = 'Active',      'Active'
        DISPOSED    = 'Disposed',    'Disposed'
        WRITTEN_OFF = 'Written Off', 'Written Off'
        IDLE        = 'Idle',        'Idle'

    class DepreciationMethod(models.TextChoices):
        SLM = 'SLM', 'Straight-Line Method'
        DBM = 'DBM', 'Declining Balance Method'

    class Condition(models.TextChoices):
        EXCELLENT = 'Excellent', 'Excellent'
        GOOD      = 'Good',      'Good'
        FAIR      = 'Fair',      'Fair'
        POOR      = 'Poor',      'Poor'

    # Identification
    asset_number         = models.CharField(max_length=20, unique=True, editable=False)
    name                 = models.CharField(max_length=150)
    description          = models.TextField(blank=True)
    category             = models.ForeignKey(AssetCategory, on_delete=models.PROTECT,
                                              related_name='assets')
    serial_number        = models.CharField(max_length=100, blank=True)
    brand                = models.CharField(max_length=100, blank=True)
    model                = models.CharField(max_length=100, blank=True)
    location             = models.CharField(max_length=150, blank=True)
    assigned_to          = models.CharField(max_length=150, blank=True,
                                            help_text='Department or employee')
    condition            = models.CharField(max_length=20, choices=Condition.choices,
                                            default=Condition.GOOD)
    status               = models.CharField(max_length=20, choices=Status.choices,
                                            default=Status.ACTIVE)

    # Financial details
    cost                 = models.DecimalField(max_digits=15, decimal_places=2,
                                               help_text='Original purchase cost (KES)')
    salvage_value        = models.DecimalField(max_digits=15, decimal_places=2, default=0,
                                               help_text='Estimated residual value (KES)')
    purchase_date        = models.DateField()
    in_service_date      = models.DateField(help_text='Date depreciation begins')
    disposal_date        = models.DateField(null=True, blank=True)

    # Depreciation config
    depreciation_method  = models.CharField(max_length=5,
                                             choices=DepreciationMethod.choices,
                                             default=DepreciationMethod.SLM)
    useful_life_months   = models.IntegerField(default=60)
    depreciation_rate    = models.DecimalField(max_digits=5, decimal_places=4, default=0,
                                               help_text='Annual rate for DBM (e.g. 0.25)')

    # Running totals — updated each time depreciation is posted
    accumulated_depreciation = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    last_depreciation_date   = models.DateField(null=True, blank=True)

    # Supplier / purchase info
    supplier             = models.CharField(max_length=150, blank=True)
    purchase_order       = models.CharField(max_length=50, blank=True)
    warranty_expiry      = models.DateField(null=True, blank=True)

    # GL Journal Entry links
    purchase_journal     = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                              on_delete=models.SET_NULL,
                                              related_name='asset_purchases')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['asset_number']

    def __str__(self):
        return f'{self.asset_number} — {self.name}'

    def save(self, *args, **kwargs):
        if not self.asset_number:
            super().save(*args, **kwargs)
            self.asset_number = f'FA-{self.pk:05d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    @property
    def book_value(self):
        from decimal import Decimal
        return Decimal(str(self.cost)) - Decimal(str(self.accumulated_depreciation))

    @property
    def depreciation_percentage(self):
        """Percentage of cost that has been depreciated."""
        if self.cost == 0:
            return 0
        return round((float(self.accumulated_depreciation) / float(self.cost)) * 100, 1)

    @property
    def is_fully_depreciated(self):
        return self.book_value <= self.salvage_value

    @property
    def remaining_life_months(self):
        from .depreciation import slm_monthly
        monthly = slm_monthly(self.cost, self.salvage_value, self.useful_life_months)
        if monthly == 0:
            return 0
        remaining = self.book_value - self.salvage_value
        return max(0, int(remaining / monthly))

    def clean(self):
        if self.salvage_value and self.salvage_value > self.cost:
            raise ValidationError('Salvage value cannot exceed cost.')
        if self.depreciation_method == 'DBM' and not self.depreciation_rate:
            raise ValidationError('Declining Balance Method requires a depreciation rate.')


class DepreciationEntry(models.Model):
    """
    Records each monthly depreciation charge for an asset.
    Linked to the GL journal entry that was posted.
    """
    asset           = models.ForeignKey(Asset, on_delete=models.CASCADE,
                                         related_name='depreciation_entries')
    period_year     = models.IntegerField()
    period_month    = models.IntegerField()
    amount          = models.DecimalField(max_digits=15, decimal_places=2)
    book_value_after= models.DecimalField(max_digits=15, decimal_places=2)
    method_used     = models.CharField(max_length=5, default='SLM')
    journal_entry   = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='depreciation_entries')
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering        = ['-period_year', '-period_month']
        unique_together = [['asset', 'period_year', 'period_month']]

    def __str__(self):
        return f'{self.asset.asset_number} | {self.period_year}/{self.period_month:02d} | KES {self.amount}'


class MaintenanceLog(models.Model):
    """
    Tracks all maintenance and repair costs for an asset.
    Maintenance costs are expensed immediately (not capitalized).
    """
    class MaintenanceType(models.TextChoices):
        PREVENTIVE  = 'Preventive',  'Preventive Maintenance'
        CORRECTIVE  = 'Corrective',  'Corrective Repair'
        INSPECTION  = 'Inspection',  'Inspection'
        UPGRADE     = 'Upgrade',     'Upgrade / Improvement'

    asset           = models.ForeignKey(Asset, on_delete=models.CASCADE,
                                         related_name='maintenance_logs')
    maintenance_type= models.CharField(max_length=20, choices=MaintenanceType.choices)
    date            = models.DateField()
    description     = models.TextField()
    cost            = models.DecimalField(max_digits=12, decimal_places=2)
    vendor          = models.CharField(max_length=150, blank=True)
    performed_by    = models.CharField(max_length=150, blank=True)
    next_maintenance= models.DateField(null=True, blank=True)
    journal_entry   = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='maintenance_logs')
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f'{self.asset.asset_number} | {self.date} | {self.maintenance_type} | KES {self.cost}'


class AssetDisposal(models.Model):
    """
    Records asset disposal and calculates gain/loss.
    Gain  = Proceeds > Book Value  → posted to Other Income
    Loss  = Proceeds < Book Value  → posted to Loss on Disposal
    """
    class DisposalMethod(models.TextChoices):
        SALE        = 'Sale',        'Sale'
        SCRAP       = 'Scrap',       'Scrap / Write-Off'
        DONATION    = 'Donation',    'Donation'
        TRADE_IN    = 'Trade-In',    'Trade-In'
        THEFT_LOSS  = 'Theft/Loss',  'Theft or Loss'

    asset           = models.OneToOneField(Asset, on_delete=models.CASCADE,
                                            related_name='disposal')
    disposal_method = models.CharField(max_length=20, choices=DisposalMethod.choices)
    disposal_date   = models.DateField()
    proceeds        = models.DecimalField(max_digits=15, decimal_places=2, default=0,
                                          help_text='Cash received from disposal (KES)')
    book_value_at_disposal = models.DecimalField(max_digits=15, decimal_places=2)
    gain_loss       = models.DecimalField(max_digits=15, decimal_places=2,
                                          help_text='Positive = gain, Negative = loss')
    notes           = models.TextField(blank=True)
    journal_entry   = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='asset_disposals')
    created_at      = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.asset.asset_number} disposed {self.disposal_date} | GL: {self.gain_loss}'


class AssetRevaluation(models.Model):
    """
    Records upward or downward revaluation of an asset.
    Upward   → Revaluation Surplus (Equity)
    Downward → Impairment Loss (Expense)
    """
    asset               = models.ForeignKey(Asset, on_delete=models.CASCADE,
                                             related_name='revaluations')
    revaluation_date    = models.DateField()
    previous_cost       = models.DecimalField(max_digits=15, decimal_places=2)
    new_cost            = models.DecimalField(max_digits=15, decimal_places=2)
    previous_accumulated= models.DecimalField(max_digits=15, decimal_places=2)
    new_accumulated     = models.DecimalField(max_digits=15, decimal_places=2)
    revaluation_amount  = models.DecimalField(max_digits=15, decimal_places=2,
                                              help_text='Positive = upward, Negative = downward')
    reason              = models.TextField()
    journal_entry       = models.ForeignKey('Finance.JournalEntry', null=True, blank=True,
                                             on_delete=models.SET_NULL,
                                             related_name='asset_revaluations')
    created_at          = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.asset.asset_number} revalued {self.revaluation_date} | {self.revaluation_amount}'