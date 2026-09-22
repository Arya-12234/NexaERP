from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Customer, Invoice, InvoiceLine, Receipt, ReceiptAllocation, CreditNote


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display  = ['customer_number', 'name', 'customer_type', 'status',
                     'wht_category', 'credit_limit', 'payment_terms_days']
    list_filter   = ['status', 'customer_type', 'wht_category']
    search_fields = ['customer_number', 'name', 'kra_pin', 'email']
    readonly_fields = ['customer_number', 'created_at', 'updated_at']


class InvoiceLineInline(admin.TabularInline):
    model   = InvoiceLine
    extra   = 1
    fields  = ['description', 'quantity', 'unit_price', 'vat_rate', 'gl_account']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display  = ['invoice_number', 'customer', 'invoice_type', 'invoice_date',
                     'due_date', 'total_amount', 'amount_collected', 'status']
    list_filter   = ['status', 'invoice_type']
    search_fields = ['invoice_number', 'customer__name', 'our_ref']
    readonly_fields = ['invoice_number', 'subtotal', 'vat_amount', 'wht_amount',
                       'total_amount', 'amount_collected',
                       'created_at', 'approved_at', 'sent_at', 'collected_at']
    inlines       = [InvoiceLineInline]


class ReceiptAllocationInline(admin.TabularInline):
    model   = ReceiptAllocation
    extra   = 1
    fields  = ['invoice', 'amount']


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display  = ['receipt_number', 'customer', 'receipt_date',
                     'payment_method', 'amount', 'wht_deducted']
    list_filter   = ['payment_method']
    search_fields = ['receipt_number', 'customer__name', 'reference']
    readonly_fields = ['receipt_number', 'created_at']
    inlines       = [ReceiptAllocationInline]


@admin.register(CreditNote)
class CreditNoteAdmin(admin.ModelAdmin):
    list_display  = ['credit_note_number', 'customer', 'invoice', 'date', 'amount']
    search_fields = ['credit_note_number', 'customer__name']
    readonly_fields = ['credit_note_number', 'created_at']