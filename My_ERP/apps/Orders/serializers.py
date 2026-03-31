from rest_framework import serializers
from .models import (
    Quotation, QuotationLine,
    SalesOrder, SalesOrderLine,
    PurchaseOrder, PurchaseOrderLine,
    Delivery, DeliveryLine,
)


# ── Quotation ─────────────────────────────────────────────────

class QuotationLineSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    vat_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model  = QuotationLine
        fields = ['id', 'product', 'description', 'quantity', 'unit_price',
                  'vat_rate', 'line_total', 'vat_amount']
        read_only_fields = ['id', 'line_total', 'vat_amount']


class QuotationSerializer(serializers.ModelSerializer):
    lines      = QuotationLineSerializer(many=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Quotation
        fields = [
            'id', 'quotation_number', 'customer', 'customer_email', 'customer_phone',
            'date', 'valid_until', 'status', 'is_expired',
            'subtotal', 'vat_amount', 'discount_amount', 'total_amount',
            'notes', 'terms', 'lines', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'quotation_number', 'subtotal', 'vat_amount',
                            'total_amount', 'is_expired', 'created_at', 'updated_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        quotation  = Quotation.objects.create(**validated_data)
        for line in lines_data:
            QuotationLine.objects.create(quotation=quotation, **line)
        quotation.recalculate_totals()
        return quotation


class QuotationListSerializer(serializers.ModelSerializer):
    is_expired  = serializers.BooleanField(read_only=True)
    line_count  = serializers.SerializerMethodField()

    class Meta:
        model  = Quotation
        fields = ['id', 'quotation_number', 'customer', 'date', 'valid_until',
                  'status', 'is_expired', 'total_amount', 'line_count', 'created_at']

    def get_line_count(self, obj):
        return obj.lines.count()


# ── Sales Order ───────────────────────────────────────────────

class SalesOrderLineSerializer(serializers.ModelSerializer):
    line_total         = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    vat_amount         = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    quantity_pending   = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_fully_delivered = serializers.BooleanField(read_only=True)
    product_name       = serializers.CharField(source='product.name', read_only=True, default='')

    class Meta:
        model  = SalesOrderLine
        fields = ['id', 'product', 'product_name', 'description', 'quantity',
                  'unit_price', 'vat_rate', 'quantity_delivered', 'quantity_pending',
                  'is_fully_delivered', 'line_total', 'vat_amount']
        read_only_fields = ['id', 'quantity_delivered', 'quantity_pending',
                            'is_fully_delivered', 'line_total', 'vat_amount', 'product_name']


class SalesOrderSerializer(serializers.ModelSerializer):
    lines            = SalesOrderLineSerializer(many=True)
    balance_due      = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name',
                                              read_only=True, default='')
    ar_invoice_number= serializers.CharField(source='ar_invoice.invoice_number',
                                              read_only=True, default='')
    warehouse_name   = serializers.CharField(source='warehouse.name', read_only=True, default='')

    class Meta:
        model  = SalesOrder
        fields = [
            'id', 'order_number', 'quotation',
            'customer', 'customer_email', 'customer_phone', 'customer_address',
            'ar_customer', 'ar_invoice', 'ar_invoice_number',
            'warehouse', 'warehouse_name',
            'order_date', 'requested_date', 'confirmed_date',
            'subtotal', 'vat_amount', 'discount_amount', 'total_amount', 'balance_due',
            'status', 'payment_status', 'rejection_reason',
            'notes', 'internal_notes', 'lines',
            'approved_by_name',
            'created_at', 'approved_at', 'shipped_at', 'delivered_at',
        ]
        read_only_fields = ['id', 'order_number', 'subtotal', 'vat_amount',
                            'total_amount', 'balance_due', 'status', 'payment_status',
                            'rejection_reason', 'approved_by_name', 'ar_invoice_number',
                            'warehouse_name', 'created_at', 'approved_at',
                            'shipped_at', 'delivered_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        order      = SalesOrder.objects.create(**validated_data)
        for line in lines_data:
            SalesOrderLine.objects.create(order=order, **line)
        order.recalculate_totals()
        return order


class SalesOrderListSerializer(serializers.ModelSerializer):
    balance_due = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default='')

    class Meta:
        model  = SalesOrder
        fields = ['id', 'order_number', 'customer', 'order_date', 'requested_date',
                  'status', 'payment_status', 'total_amount', 'balance_due',
                  'warehouse_name', 'created_at']


# ── Purchase Order ────────────────────────────────────────────

class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    line_total        = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    vat_amount        = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    quantity_pending  = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_fully_received = serializers.BooleanField(read_only=True)
    product_name      = serializers.CharField(source='product.name', read_only=True, default='')

    class Meta:
        model  = PurchaseOrderLine
        fields = ['id', 'product', 'product_name', 'description', 'quantity',
                  'unit_cost', 'vat_rate', 'quantity_received', 'quantity_pending',
                  'is_fully_received', 'line_total', 'vat_amount']
        read_only_fields = ['id', 'quantity_received', 'quantity_pending',
                            'is_fully_received', 'line_total', 'vat_amount', 'product_name']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines            = PurchaseOrderLineSerializer(many=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name',
                                              read_only=True, default='')
    warehouse_name   = serializers.CharField(source='warehouse.name', read_only=True, default='')
    ap_vendor_name   = serializers.CharField(source='ap_vendor.name', read_only=True, default='')
    ap_bill_number   = serializers.CharField(source='ap_bill.bill_number', read_only=True, default='')

    class Meta:
        model  = PurchaseOrder
        fields = [
            'id', 'order_number', 'supplier', 'supplier_email',
            'supplier_phone', 'supplier_ref',
            'ap_vendor', 'ap_vendor_name', 'ap_bill', 'ap_bill_number',
            'warehouse', 'warehouse_name',
            'order_date', 'expected_date', 'received_date',
            'subtotal', 'vat_amount', 'discount_amount', 'total_amount',
            'status', 'rejection_reason', 'notes', 'terms', 'lines',
            'approved_by_name',
            'created_at', 'approved_at', 'sent_at',
        ]
        read_only_fields = ['id', 'order_number', 'subtotal', 'vat_amount',
                            'total_amount', 'status', 'rejection_reason',
                            'approved_by_name', 'ap_vendor_name', 'ap_bill_number',
                            'warehouse_name', 'created_at', 'approved_at', 'sent_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        order      = PurchaseOrder.objects.create(**validated_data)
        for line in lines_data:
            PurchaseOrderLine.objects.create(order=order, **line)
        order.recalculate_totals()
        return order


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default='')
    line_count     = serializers.SerializerMethodField()

    class Meta:
        model  = PurchaseOrder
        fields = ['id', 'order_number', 'supplier', 'order_date', 'expected_date',
                  'status', 'total_amount', 'warehouse_name', 'line_count', 'created_at']

    def get_line_count(self, obj):
        return obj.lines.count()


# ── Delivery ──────────────────────────────────────────────────

class DeliveryLineSerializer(serializers.ModelSerializer):
    description = serializers.CharField(source='order_line.description', read_only=True)

    class Meta:
        model  = DeliveryLine
        fields = ['id', 'order_line', 'description', 'quantity', 'notes']
        read_only_fields = ['id', 'description']


class DeliverySerializer(serializers.ModelSerializer):
    lines              = DeliveryLineSerializer(many=True, read_only=True)
    order_number       = serializers.CharField(source='sales_order.order_number', read_only=True)
    customer           = serializers.CharField(source='sales_order.customer',     read_only=True)

    class Meta:
        model  = Delivery
        fields = [
            'id', 'delivery_number', 'sales_order', 'order_number', 'customer',
            'status', 'delivery_address', 'carrier', 'tracking_number',
            'driver_name', 'driver_phone', 'vehicle_number',
            'scheduled_date', 'dispatched_at', 'delivered_at',
            'notes', 'lines', 'created_at',
        ]
        read_only_fields = ['id', 'delivery_number', 'order_number',
                            'customer', 'lines', 'created_at']


class DeliveryListSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='sales_order.order_number', read_only=True)
    customer     = serializers.CharField(source='sales_order.customer',     read_only=True)

    class Meta:
        model  = Delivery
        fields = ['id', 'delivery_number', 'order_number', 'customer',
                  'status', 'scheduled_date', 'carrier', 'tracking_number', 'created_at']