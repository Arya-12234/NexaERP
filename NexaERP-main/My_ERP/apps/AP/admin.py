from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Vendor, Bill, BillLine, Payment, PaymentAllocation


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display  = ['vendor_number', 'name', 'vendor_type', 'status',
                     'wht_category', 'credit_limit', 'payment_terms_days']
    list_filter   = ['status', 'vendor_type', 'wht_category']
    search_fields = ['vendor_number', 'name', 'kra_pin', 'email']
    readonly_fields = ['vendor_number', 'created_at', 'updated_at']


class BillLineInline(admin.TabularInline):
    model   = BillLine
    extra   = 1
    fields  = ['description', 'quantity', 'unit_price', 'vat_rate', 'gl_account']


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display  = ['bill_number', 'vendor', 'bill_date', 'due_date',
                     'total_amount', 'amount_paid', 'status']
    list_filter   = ['status', 'bill_type']
    search_fields = ['bill_number', 'vendor__name', 'vendor_ref']
    readonly_fields = ['bill_number', 'subtotal', 'wht_amount', 'total_amount',
                       'amount_paid', 'created_at', 'submitted_at',
                       'procurement_approved_at', 'finance_approved_at',
                       'rejected_at', 'paid_at']
    inlines       = [BillLineInline]


class PaymentAllocationInline(admin.TabularInline):
    model   = PaymentAllocation
    extra   = 1
    fields  = ['bill', 'amount']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = ['payment_number', 'vendor', 'payment_date',
                     'payment_method', 'amount', 'wht_deducted']
    list_filter   = ['payment_method']
    search_fields = ['payment_number', 'vendor__name', 'reference']
    readonly_fields = ['payment_number', 'created_at']
    inlines       = [PaymentAllocationInline]