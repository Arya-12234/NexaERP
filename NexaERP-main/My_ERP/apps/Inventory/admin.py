from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import (
    Category, Warehouse, Product, WarehouseInventory,
    StockMovement, PurchaseOrder, PurchaseOrderLine,
    StockAdjustment, FIFOLayer,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display  = ['name', 'parent', 'created_at']
    search_fields = ['name']


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display  = ['code', 'name', 'city', 'manager', 'status', 'is_default']
    list_filter   = ['status']
    search_fields = ['code', 'name', 'city']


class WarehouseInventoryInline(admin.TabularInline):
    model   = WarehouseInventory
    extra   = 0
    fields  = ['warehouse', 'quantity_on_hand', 'quantity_reserved', 'quantity_available']
    readonly_fields = ['quantity_available', 'last_updated']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display  = ['sku', 'name', 'category', 'product_type', 'status',
                     'valuation_method', 'cost_price', 'selling_price']
    list_filter   = ['status', 'product_type', 'valuation_method', 'category']
    search_fields = ['sku', 'barcode', 'name']
    readonly_fields = ['created_at', 'updated_at']
    inlines       = [WarehouseInventoryInline]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display  = ['reference', 'product', 'warehouse', 'movement_type',
                     'quantity', 'unit_cost', 'total_cost', 'date']
    list_filter   = ['movement_type', 'warehouse']
    search_fields = ['reference', 'product__sku', 'product__name', 'source_ref']
    readonly_fields = ['reference', 'total_cost', 'quantity_before', 'quantity_after', 'created_at']


class PurchaseOrderLineInline(admin.TabularInline):
    model   = PurchaseOrderLine
    extra   = 1
    fields  = ['product', 'quantity_ordered', 'quantity_received', 'unit_cost', 'vat_rate']
    readonly_fields = ['quantity_received']


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display  = ['po_number', 'supplier', 'warehouse', 'order_date',
                     'expected_date', 'total_amount', 'status']
    list_filter   = ['status', 'warehouse']
    search_fields = ['po_number', 'supplier', 'supplier_ref']
    readonly_fields = ['po_number', 'subtotal', 'vat_amount', 'total_amount',
                       'approved_at', 'created_at']
    inlines       = [PurchaseOrderLineInline]


@admin.register(StockAdjustment)
class StockAdjustmentAdmin(admin.ModelAdmin):
    list_display  = ['reference', 'product', 'warehouse', 'reason',
                     'quantity_before', 'quantity_after', 'adjustment_qty', 'date']
    list_filter   = ['reason', 'warehouse']
    search_fields = ['reference', 'product__sku', 'product__name']
    readonly_fields = ['reference', 'adjustment_qty', 'total_cost', 'created_at']


@admin.register(FIFOLayer)
class FIFOLayerAdmin(admin.ModelAdmin):
    list_display  = ['product', 'warehouse', 'receipt_date', 'quantity_in',
                     'quantity_remaining', 'unit_cost', 'source_ref']
    list_filter   = ['warehouse']
    search_fields = ['product__sku', 'source_ref']