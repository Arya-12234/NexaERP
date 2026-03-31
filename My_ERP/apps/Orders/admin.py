from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import (
    Quotation, QuotationLine,
    SalesOrder, SalesOrderLine,
    PurchaseOrder, PurchaseOrderLine,
    Delivery, DeliveryLine,
)


class QuotationLineInline(admin.TabularInline):
    model  = QuotationLine
    extra  = 1
    fields = ['product', 'description', 'quantity', 'unit_price', 'vat_rate']


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display  = ['quotation_number', 'customer', 'date', 'valid_until',
                     'total_amount', 'status']
    list_filter   = ['status']
    search_fields = ['quotation_number', 'customer']
    readonly_fields = ['quotation_number', 'subtotal', 'vat_amount',
                       'total_amount', 'created_at', 'updated_at']
    inlines       = [QuotationLineInline]


class SalesOrderLineInline(admin.TabularInline):
    model  = SalesOrderLine
    extra  = 1
    fields = ['product', 'description', 'quantity', 'unit_price',
              'vat_rate', 'quantity_delivered']
    readonly_fields = ['quantity_delivered']


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display  = ['order_number', 'customer', 'order_date', 'requested_date',
                     'total_amount', 'status', 'payment_status']
    list_filter   = ['status', 'payment_status']
    search_fields = ['order_number', 'customer']
    readonly_fields = ['order_number', 'subtotal', 'vat_amount', 'total_amount',
                       'created_at', 'approved_at', 'shipped_at', 'delivered_at']
    inlines       = [SalesOrderLineInline]


class PurchaseOrderLineInline(admin.TabularInline):
    model  = PurchaseOrderLine
    extra  = 1
    fields = ['product', 'description', 'quantity', 'unit_cost',
              'vat_rate', 'quantity_received']
    readonly_fields = ['quantity_received']


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display  = ['order_number', 'supplier', 'order_date', 'expected_date',
                     'total_amount', 'status']
    list_filter   = ['status']
    search_fields = ['order_number', 'supplier']
    readonly_fields = ['order_number', 'subtotal', 'vat_amount', 'total_amount',
                       'created_at', 'approved_at', 'sent_at']
    inlines       = [PurchaseOrderLineInline]


class DeliveryLineInline(admin.TabularInline):
    model  = DeliveryLine
    extra  = 1
    fields = ['order_line', 'quantity', 'notes']


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display  = ['delivery_number', 'sales_order', 'status',
                     'scheduled_date', 'carrier', 'tracking_number']
    list_filter   = ['status']
    search_fields = ['delivery_number', 'sales_order__order_number',
                     'carrier', 'tracking_number']
    readonly_fields = ['delivery_number', 'dispatched_at', 'delivered_at', 'created_at']
    inlines       = [DeliveryLineInline]