from rest_framework import serializers
from .models import Vendor, Bill, BillLine, Payment, PaymentAllocation
from decimal import Decimal


class VendorSerializer(serializers.ModelSerializer):
    outstanding_balance = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    credit_available    = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True, allow_null=True)
    is_over_credit_limit = serializers.BooleanField(read_only=True)
    wht_rate            = serializers.DecimalField(max_digits=5, decimal_places=4, read_only=True)
    bill_count          = serializers.SerializerMethodField()

    class Meta:
        model  = Vendor
        fields = [
            'id', 'vendor_number', 'name', 'vendor_type', 'status',
            'contact_person', 'email', 'phone', 'address', 'city', 'country', 'website',
            'kra_pin', 'vat_number', 'wht_category', 'wht_rate',
            'bank_name', 'bank_branch', 'account_number', 'account_name',
            'credit_limit', 'payment_terms_days',
            'early_payment_discount_pct', 'early_payment_days',
            'outstanding_balance', 'credit_available', 'is_over_credit_limit',
            'bill_count', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'vendor_number', 'outstanding_balance',
                            'credit_available', 'is_over_credit_limit',
                            'wht_rate', 'bill_count', 'created_at', 'updated_at']

    def get_bill_count(self, obj):
        return obj.bills.count()


class VendorListSerializer(serializers.ModelSerializer):
    outstanding_balance  = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    is_over_credit_limit = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Vendor
        fields = ['id', 'vendor_number', 'name', 'vendor_type', 'status',
                  'wht_category', 'credit_limit', 'outstanding_balance',
                  'is_over_credit_limit', 'payment_terms_days']


class BillLineSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    vat_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model  = BillLine
        fields = ['id', 'description', 'quantity', 'unit_price',
                  'vat_rate', 'gl_account', 'line_total', 'vat_amount']
        read_only_fields = ['id', 'line_total', 'vat_amount']


class BillSerializer(serializers.ModelSerializer):
    lines               = BillLineSerializer(many=True)
    vendor_name         = serializers.CharField(source='vendor.name',        read_only=True)
    vendor_number       = serializers.CharField(source='vendor.vendor_number', read_only=True)
    wht_category        = serializers.CharField(source='vendor.wht_category', read_only=True)
    balance_due         = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    is_overdue          = serializers.BooleanField(read_only=True)
    days_overdue        = serializers.IntegerField(read_only=True)
    early_payment_discount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    # Approval actors
    submitted_by_name           = serializers.CharField(source='submitted_by.get_full_name',           read_only=True, default='')
    procurement_approved_by_name= serializers.CharField(source='procurement_approved_by.get_full_name',read_only=True, default='')
    finance_approved_by_name    = serializers.CharField(source='finance_approved_by.get_full_name',    read_only=True, default='')
    rejected_by_name            = serializers.CharField(source='rejected_by.get_full_name',            read_only=True, default='')

    class Meta:
        model  = Bill
        fields = [
            'id', 'bill_number', 'vendor', 'vendor_name', 'vendor_number',
            'bill_type', 'vendor_ref', 'bill_date', 'due_date', 'received_date',
            'subtotal', 'vat_amount', 'wht_amount', 'discount_amount', 'total_amount',
            'amount_paid', 'balance_due', 'wht_category',
            'is_overdue', 'days_overdue', 'early_payment_discount',
            'status', 'rejection_reason', 'notes', 'lines',
            'submitted_by_name', 'procurement_approved_by_name',
            'finance_approved_by_name', 'rejected_by_name',
            'created_at', 'submitted_at', 'procurement_approved_at',
            'finance_approved_at', 'rejected_at', 'paid_at',
        ]
        read_only_fields = [
            'id', 'bill_number', 'subtotal', 'wht_amount', 'total_amount',
            'amount_paid', 'balance_due', 'is_overdue', 'days_overdue',
            'early_payment_discount', 'status', 'rejection_reason',
            'submitted_by_name', 'procurement_approved_by_name',
            'finance_approved_by_name', 'rejected_by_name',
            'created_at', 'submitted_at', 'procurement_approved_at',
            'finance_approved_at', 'rejected_at', 'paid_at',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        bill       = Bill.objects.create(**validated_data)
        for line in lines_data:
            BillLine.objects.create(bill=bill, **line)
        bill.recalculate_totals()
        return bill


class BillListSerializer(serializers.ModelSerializer):
    vendor_name  = serializers.CharField(source='vendor.name', read_only=True)
    balance_due  = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    is_overdue   = serializers.BooleanField(read_only=True)
    days_overdue = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Bill
        fields = [
            'id', 'bill_number', 'vendor_name', 'bill_type', 'vendor_ref',
            'bill_date', 'due_date', 'total_amount', 'amount_paid',
            'balance_due', 'status', 'is_overdue', 'days_overdue',
        ]


class PaymentAllocationSerializer(serializers.ModelSerializer):
    bill_number  = serializers.CharField(source='bill.bill_number', read_only=True)
    vendor_name  = serializers.CharField(source='bill.vendor.name', read_only=True)

    class Meta:
        model  = PaymentAllocation
        fields = ['id', 'bill', 'bill_number', 'vendor_name', 'amount']


class PaymentSerializer(serializers.ModelSerializer):
    vendor_name  = serializers.CharField(source='vendor.name', read_only=True)
    allocations  = PaymentAllocationSerializer(many=True, read_only=True)

    class Meta:
        model  = Payment
        fields = [
            'id', 'payment_number', 'vendor', 'vendor_name',
            'payment_date', 'payment_method', 'amount', 'wht_deducted',
            'reference', 'notes', 'allocations', 'created_at',
        ]
        read_only_fields = ['id', 'payment_number', 'vendor_name', 'allocations', 'created_at']