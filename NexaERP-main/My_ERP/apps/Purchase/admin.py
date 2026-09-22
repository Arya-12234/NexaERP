from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import (
    Supplier, PurchaseRequisition, RequisitionLine,
    PurchaseBudget, GoodsReceivedNote, GRNLine, SupplierRating,
)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display  = ['supplier_number', 'name', 'supplier_type', 'status',
                     'city', 'total_spend', 'average_rating', 'on_time_delivery_pct']
    list_filter   = ['status', 'supplier_type']
    search_fields = ['supplier_number', 'name', 'kra_pin', 'email']
    readonly_fields = ['supplier_number', 'total_orders', 'total_spend',
                       'average_rating', 'on_time_delivery_pct', 'created_at', 'updated_at']


class RequisitionLineInline(admin.TabularInline):
    model  = RequisitionLine
    extra  = 1
    fields = ['product', 'description', 'quantity', 'unit_of_measure', 'estimated_price']


@admin.register(PurchaseRequisition)
class PurchaseRequisitionAdmin(admin.ModelAdmin):
    list_display  = ['pr_number', 'title', 'department', 'requested_by',
                     'priority', 'status', 'total_amount', 'date_required']
    list_filter   = ['status', 'priority', 'department']
    search_fields = ['pr_number', 'title', 'requested_by']
    readonly_fields = ['pr_number', 'subtotal', 'total_amount',
                       'created_at', 'submitted_at', 'approved_at']
    inlines       = [RequisitionLineInline]


@admin.register(PurchaseBudget)
class PurchaseBudgetAdmin(admin.ModelAdmin):
    list_display  = ['department', 'category', 'period', 'year', 'month',
                     'budget_amount', 'spent_amount']
    list_filter   = ['period', 'year', 'department']


class GRNLineInline(admin.TabularInline):
    model  = GRNLine
    extra  = 1
    fields = ['product', 'description', 'quantity_ordered',
              'quantity_received', 'unit_cost', 'condition']


@admin.register(GoodsReceivedNote)
class GRNAdmin(admin.ModelAdmin):
    list_display  = ['grn_number', 'supplier', 'warehouse', 'received_date',
                     'po_reference', 'status', 'total_items', 'total_value']
    list_filter   = ['status', 'warehouse']
    search_fields = ['grn_number', 'supplier__name', 'po_reference']
    readonly_fields = ['grn_number', 'total_items', 'total_value', 'created_at']
    inlines       = [GRNLineInline]


@admin.register(SupplierRating)
class SupplierRatingAdmin(admin.ModelAdmin):
    list_display  = ['supplier', 'date', 'overall_rating', 'on_time_delivery',
                     'quality_rating', 'delivery_rating']
    list_filter   = ['on_time_delivery']
    search_fields = ['supplier__name', 'po_reference']
    readonly_fields = ['overall_rating', 'created_at']