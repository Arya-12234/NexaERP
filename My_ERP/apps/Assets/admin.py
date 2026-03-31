from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import AssetCategory, Asset, DepreciationEntry, MaintenanceLog, AssetDisposal, AssetRevaluation


@admin.register(AssetCategory)
class AssetCategoryAdmin(admin.ModelAdmin):
    list_display  = ['name', 'depreciation_method', 'default_useful_life_months', 'default_depreciation_rate']
    search_fields = ['name']


class DepreciationEntryInline(admin.TabularInline):
    model       = DepreciationEntry
    extra       = 0
    readonly_fields = ['period_year', 'period_month', 'amount', 'book_value_after', 'method_used']
    can_delete  = False

    def has_add_permission(self, request, obj=None):
        return False


class MaintenanceInline(admin.TabularInline):
    model   = MaintenanceLog
    extra   = 0
    fields  = ['date', 'maintenance_type', 'description', 'cost', 'vendor']


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display    = ['asset_number', 'name', 'category', 'status', 'cost',
                       'accumulated_depreciation', 'last_depreciation_date']
    list_filter     = ['status', 'category', 'depreciation_method']
    search_fields   = ['asset_number', 'name', 'serial_number']
    readonly_fields = ['asset_number', 'accumulated_depreciation',
                       'last_depreciation_date', 'created_at', 'updated_at']
    inlines         = [DepreciationEntryInline, MaintenanceInline]


@admin.register(DepreciationEntry)
class DepreciationEntryAdmin(admin.ModelAdmin):
    list_display  = ['asset', 'period_year', 'period_month', 'amount', 'book_value_after']
    list_filter   = ['period_year', 'method_used']
    readonly_fields = ['asset', 'period_year', 'period_month', 'amount',
                       'book_value_after', 'method_used', 'created_at']


@admin.register(MaintenanceLog)
class MaintenanceLogAdmin(admin.ModelAdmin):
    list_display  = ['asset', 'date', 'maintenance_type', 'cost', 'vendor']
    list_filter   = ['maintenance_type']
    search_fields = ['asset__asset_number', 'asset__name', 'description']


@admin.register(AssetDisposal)
class AssetDisposalAdmin(admin.ModelAdmin):
    list_display  = ['asset', 'disposal_date', 'disposal_method', 'proceeds',
                     'book_value_at_disposal', 'gain_loss']
    readonly_fields = ['book_value_at_disposal', 'gain_loss', 'created_at']


@admin.register(AssetRevaluation)
class AssetRevaluationAdmin(admin.ModelAdmin):
    list_display  = ['asset', 'revaluation_date', 'previous_cost', 'new_cost', 'revaluation_amount']
    readonly_fields = ['previous_cost', 'previous_accumulated', 'revaluation_amount', 'created_at']