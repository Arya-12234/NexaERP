from rest_framework import serializers
from .models import Customer, Invoice, InvoiceLine, Receipt, ReceiptAllocation, CreditNote
from decimal import Decimal


class CustomerSerializer(serializers.ModelSerializer):
    outstanding_balance  = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    credit_available     = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True, allow_null=True)
    is_over_credit_limit = serializers.BooleanField(read_only=True)
    wht_rate             = serializers.DecimalField(max_digits=5, decimal_places=4, read_only=True)
    invoice_count        = serializers.SerializerMethodField()

    class Meta:
        model  = Customer
        fields = [
            'id', 'customer_number', 'name', 'customer_type', 'status',
            'contact_person', 'email', 'phone', 'address', 'city', 'country', 'website',
            'kra_pin', 'vat_number', 'wht_category', 'wht_rate',
            'credit_limit', 'payment_terms_days',
            'early_payment_discount_pct', 'early_payment_days',
            'outstanding_balance', 'credit_available', 'is_over_credit_limit',
            'invoice_count', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'customer_number', 'outstanding_balance',
                            'credit_available', 'is_over_credit_limit',
                            'wht_rate', 'invoice_count', 'created_at', 'updated_at']

    def get_invoice_count(self, obj):
        return obj.invoices.count()


class CustomerListSerializer(serializers.ModelSerializer):
    outstanding_balance  = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    is_over_credit_limit = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Customer
        fields = ['id', 'customer_number', 'name', 'customer_type', 'status',
                  'wht_category', 'credit_limit', 'outstanding_balance',
                  'is_over_credit_limit', 'payment_terms_days']


class InvoiceLineSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    vat_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model  = InvoiceLine
        fields = ['id', 'description', 'quantity', 'unit_price',
                  'vat_rate', 'gl_account', 'line_total', 'vat_amount']
        read_only_fields = ['id', 'line_total', 'vat_amount']


class InvoiceSerializer(serializers.ModelSerializer):
    lines                  = InvoiceLineSerializer(many=True)
    customer_name          = serializers.CharField(source='customer.name',          read_only=True)
    customer_number        = serializers.CharField(source='customer.customer_number', read_only=True)
    wht_category           = serializers.CharField(source='customer.wht_category',  read_only=True)
    balance_due            = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    is_overdue             = serializers.BooleanField(read_only=True)
    days_overdue           = serializers.IntegerField(read_only=True)
    early_payment_discount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    approved_by_name       = serializers.CharField(source='approved_by.get_full_name', read_only=True, default='')

    class Meta:
        model  = Invoice
        fields = [
            'id', 'invoice_number', 'customer', 'customer_name', 'customer_number',
            'invoice_type', 'our_ref', 'invoice_date', 'due_date',
            'service_period_start', 'service_period_end',
            'subtotal', 'vat_amount', 'wht_amount', 'discount_amount', 'total_amount',
            'amount_collected', 'balance_due', 'wht_category',
            'is_overdue', 'days_overdue', 'early_payment_discount',
            'is_recurring', 'recurrence_interval', 'next_invoice_date',
            'status', 'notes', 'lines',
            'approved_by_name',
            'created_at', 'approved_at', 'sent_at', 'collected_at',
        ]
        read_only_fields = [
            'id', 'invoice_number', 'subtotal', 'vat_amount', 'wht_amount',
            'total_amount', 'amount_collected', 'balance_due',
            'is_overdue', 'days_overdue', 'early_payment_discount',
            'status', 'approved_by_name',
            'created_at', 'approved_at', 'sent_at', 'collected_at',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        invoice    = Invoice.objects.create(**validated_data)
        for line in lines_data:
            InvoiceLine.objects.create(invoice=invoice, **line)
        invoice.recalculate_totals()
        return invoice


class InvoiceListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    balance_due   = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    is_overdue    = serializers.BooleanField(read_only=True)
    days_overdue  = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Invoice
        fields = [
            'id', 'invoice_number', 'customer_name', 'invoice_type',
            'invoice_date', 'due_date', 'total_amount', 'amount_collected',
            'balance_due', 'status', 'is_overdue', 'days_overdue',
        ]


class ReceiptAllocationSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model  = ReceiptAllocation
        fields = ['id', 'invoice', 'invoice_number', 'amount']


class ReceiptSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    allocations   = ReceiptAllocationSerializer(many=True, read_only=True)

    class Meta:
        model  = Receipt
        fields = [
            'id', 'receipt_number', 'customer', 'customer_name',
            'receipt_date', 'payment_method', 'amount', 'wht_deducted',
            'reference', 'notes', 'allocations', 'created_at',
        ]
        read_only_fields = ['id', 'receipt_number', 'customer_name', 'allocations', 'created_at']


class CreditNoteSerializer(serializers.ModelSerializer):
    customer_name  = serializers.CharField(source='customer.name',          read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model  = CreditNote
        fields = [
            'id', 'credit_note_number', 'invoice', 'invoice_number',
            'customer', 'customer_name', 'date', 'amount', 'reason', 'created_at',
        ]
        read_only_fields = ['id', 'credit_note_number', 'invoice_number',
                            'customer_name', 'created_at']