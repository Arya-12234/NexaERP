from rest_framework import serializers
from .models import (
    Category, Warehouse, Product, WarehouseInventory,
    StockMovement, PurchaseOrder, PurchaseOrderLine,
    StockAdjustment, FIFOLayer,
)


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    class Meta:
        model  = Category
        fields = ['id', 'name', 'description', 'parent', 'product_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_product_count(self, obj):
        return obj.products.count()


class WarehouseSerializer(serializers.ModelSerializer):
    total_products = serializers.SerializerMethodField()
    total_value    = serializers.SerializerMethodField()

    class Meta:
        model  = Warehouse
        fields = ['id', 'name', 'code', 'address', 'city', 'manager',
                  'phone', 'status', 'is_default', 'total_products', 'total_value', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_total_products(self, obj):
        return obj.inventory.filter(quantity_on_hand__gt=0).count()

    def get_total_value(self, obj):
        return sum(
            inv.quantity_on_hand * inv.product.cost_price
            for inv in obj.inventory.select_related('product').all()
        )


class WarehouseInventorySerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    warehouse_code = serializers.CharField(source='warehouse.code', read_only=True)

    class Meta:
        model  = WarehouseInventory
        fields = ['id', 'warehouse', 'warehouse_name', 'warehouse_code',
                  'quantity_on_hand', 'quantity_reserved', 'quantity_available', 'last_updated']
        read_only_fields = ['id', 'quantity_available', 'last_updated']


class ProductListSerializer(serializers.ModelSerializer):
    category_name       = serializers.CharField(source='category.name', read_only=True)
    total_stock         = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_stock_value   = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    is_below_reorder_point = serializers.BooleanField(read_only=True)
    is_out_of_stock     = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Product
        fields = [
            'id', 'sku', 'barcode', 'name', 'category_name', 'product_type',
            'status', 'unit_of_measure', 'valuation_method',
            'cost_price', 'selling_price', 'vat_rate',
            'total_stock', 'total_stock_value',
            'reorder_point', 'is_below_reorder_point', 'is_out_of_stock',
        ]


class ProductSerializer(serializers.ModelSerializer):
    category_name       = serializers.CharField(source='category.name', read_only=True)
    total_stock         = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_stock_value   = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    is_below_reorder_point = serializers.BooleanField(read_only=True)
    is_out_of_stock     = serializers.BooleanField(read_only=True)
    inventory           = WarehouseInventorySerializer(many=True, read_only=True)

    class Meta:
        model  = Product
        fields = [
            'id', 'sku', 'barcode', 'name', 'description', 'category', 'category_name',
            'product_type', 'status', 'unit_of_measure', 'valuation_method',
            'cost_price', 'selling_price', 'vat_rate',
            'track_stock', 'reorder_point', 'reorder_quantity',
            'minimum_stock', 'maximum_stock',
            'preferred_supplier', 'supplier_sku', 'lead_time_days',
            'inventory_account', 'cogs_account', 'revenue_account',
            'total_stock', 'total_stock_value',
            'is_below_reorder_point', 'is_out_of_stock',
            'inventory', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'total_stock', 'total_stock_value',
                            'is_below_reorder_point', 'is_out_of_stock',
                            'created_at', 'updated_at']


class StockMovementSerializer(serializers.ModelSerializer):
    product_name    = serializers.CharField(source='product.name',      read_only=True)
    product_sku     = serializers.CharField(source='product.sku',       read_only=True)
    warehouse_name  = serializers.CharField(source='warehouse.name',    read_only=True)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True, default='')

    class Meta:
        model  = StockMovement
        fields = [
            'id', 'reference', 'product', 'product_name', 'product_sku',
            'warehouse', 'warehouse_name', 'to_warehouse', 'to_warehouse_name',
            'movement_type', 'quantity', 'unit_cost', 'total_cost',
            'quantity_before', 'quantity_after',
            'date', 'notes', 'source_ref', 'created_at',
        ]
        read_only_fields = ['id', 'reference', 'total_cost',
                            'quantity_before', 'quantity_after', 'created_at']


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    product_name    = serializers.CharField(source='product.name', read_only=True)
    product_sku     = serializers.CharField(source='product.sku',  read_only=True)
    line_total      = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    vat_amount      = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    quantity_pending= serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_fully_received = serializers.BooleanField(read_only=True)

    class Meta:
        model  = PurchaseOrderLine
        fields = [
            'id', 'product', 'product_name', 'product_sku',
            'quantity_ordered', 'quantity_received', 'quantity_pending',
            'unit_cost', 'vat_rate', 'line_total', 'vat_amount', 'is_fully_received',
        ]
        read_only_fields = ['id', 'quantity_received', 'quantity_pending',
                            'line_total', 'vat_amount', 'is_fully_received']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines            = PurchaseOrderLineSerializer(many=True)
    warehouse_name   = serializers.CharField(source='warehouse.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name',
                                              read_only=True, default='')

    class Meta:
        model  = PurchaseOrder
        fields = [
            'id', 'po_number', 'supplier', 'supplier_ref',
            'warehouse', 'warehouse_name',
            'order_date', 'expected_date', 'status',
            'subtotal', 'vat_amount', 'total_amount',
            'approved_by_name', 'approved_at',
            'notes', 'lines', 'created_at',
        ]
        read_only_fields = ['id', 'po_number', 'subtotal', 'vat_amount',
                            'total_amount', 'status', 'approved_by_name',
                            'approved_at', 'created_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        po         = PurchaseOrder.objects.create(**validated_data)
        for line in lines_data:
            PurchaseOrderLine.objects.create(po=po, **line)
        po.recalculate_totals()
        return po


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    line_count     = serializers.SerializerMethodField()

    class Meta:
        model  = PurchaseOrder
        fields = ['id', 'po_number', 'supplier', 'warehouse_name',
                  'order_date', 'expected_date', 'status',
                  'total_amount', 'line_count', 'created_at']
        read_only_fields = fields

    def get_line_count(self, obj):
        return obj.lines.count()


class StockAdjustmentSerializer(serializers.ModelSerializer):
    product_name   = serializers.CharField(source='product.name',   read_only=True)
    product_sku    = serializers.CharField(source='product.sku',    read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

    class Meta:
        model  = StockAdjustment
        fields = [
            'id', 'reference', 'product', 'product_name', 'product_sku',
            'warehouse', 'warehouse_name',
            'reason', 'quantity_before', 'quantity_after', 'adjustment_qty',
            'unit_cost', 'total_cost', 'date', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'reference', 'adjustment_qty',
                            'total_cost', 'created_at']