from rest_framework import serializers
from .models import (
    Supplier, PurchaseRequisition, RequisitionLine,
    PurchaseBudget, GoodsReceivedNote, GRNLine, SupplierRating,
)


class SupplierSerializer(serializers.ModelSerializer):
    rating_count = serializers.SerializerMethodField()

    class Meta:
        model  = Supplier
        fields = [
            'id', 'supplier_number', 'name', 'supplier_type', 'status',
            'contact_person', 'email', 'phone', 'address', 'city', 'country', 'website',
            'kra_pin', 'vat_number',
            'bank_name', 'account_number', 'account_name',
            'payment_terms_days', 'credit_limit', 'currency',
            'lead_time_days', 'minimum_order_amount', 'categories_supplied',
            'total_orders', 'total_spend', 'average_rating', 'on_time_delivery_pct',
            'rating_count', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'supplier_number', 'total_orders', 'total_spend',
                            'average_rating', 'on_time_delivery_pct',
                            'rating_count', 'created_at', 'updated_at']

    def get_rating_count(self, obj):
        return obj.ratings.count()


class SupplierListSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Supplier
        fields = ['id', 'supplier_number', 'name', 'supplier_type', 'status',
                  'city', 'payment_terms_days', 'total_spend',
                  'average_rating', 'on_time_delivery_pct']


class RequisitionLineSerializer(serializers.ModelSerializer):
    estimated_total = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    product_name    = serializers.CharField(source='product.name', read_only=True, default='')

    class Meta:
        model  = RequisitionLine
        fields = ['id', 'product', 'product_name', 'description', 'quantity',
                  'unit_of_measure', 'estimated_price', 'estimated_total', 'notes']
        read_only_fields = ['id', 'estimated_total', 'product_name']


class PurchaseRequisitionSerializer(serializers.ModelSerializer):
    lines            = RequisitionLineSerializer(many=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name',
                                              read_only=True, default='')
    supplier_name    = serializers.CharField(source='preferred_supplier.name',
                                              read_only=True, default='')

    class Meta:
        model  = PurchaseRequisition
        fields = [
            'id', 'pr_number', 'title', 'department', 'requested_by',
            'priority', 'status', 'date_required',
            'preferred_supplier', 'supplier_name',
            'subtotal', 'total_amount',
            'justification', 'rejection_reason', 'notes', 'lines',
            'approved_by_name',
            'created_at', 'submitted_at', 'approved_at',
        ]
        read_only_fields = ['id', 'pr_number', 'subtotal', 'total_amount',
                            'status', 'rejection_reason', 'approved_by_name',
                            'supplier_name', 'created_at', 'submitted_at', 'approved_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        pr         = PurchaseRequisition.objects.create(**validated_data)
        for line in lines_data:
            RequisitionLine.objects.create(requisition=pr, **line)
        pr.recalculate_totals()
        return pr


class PurchaseRequisitionListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='preferred_supplier.name',
                                           read_only=True, default='')
    line_count    = serializers.SerializerMethodField()

    class Meta:
        model  = PurchaseRequisition
        fields = ['id', 'pr_number', 'title', 'department', 'requested_by',
                  'priority', 'status', 'date_required', 'total_amount',
                  'supplier_name', 'line_count', 'created_at']

    def get_line_count(self, obj):
        return obj.lines.count()


class PurchaseBudgetSerializer(serializers.ModelSerializer):
    remaining       = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    utilization_pct = serializers.FloatField(read_only=True)
    is_over_budget  = serializers.BooleanField(read_only=True)

    class Meta:
        model  = PurchaseBudget
        fields = [
            'id', 'department', 'category', 'period', 'year', 'month', 'quarter',
            'budget_amount', 'spent_amount', 'remaining',
            'utilization_pct', 'is_over_budget', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'remaining', 'utilization_pct',
                            'is_over_budget', 'created_at']


class GRNLineSerializer(serializers.ModelSerializer):
    line_total        = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    quantity_variance = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    product_name      = serializers.CharField(source='product.name', read_only=True, default='')

    class Meta:
        model  = GRNLine
        fields = ['id', 'product', 'product_name', 'description',
                  'quantity_ordered', 'quantity_received', 'quantity_variance',
                  'unit_cost', 'condition', 'line_total', 'notes']
        read_only_fields = ['id', 'line_total', 'quantity_variance', 'product_name']


class GoodsReceivedNoteSerializer(serializers.ModelSerializer):
    lines            = GRNLineSerializer(many=True)
    supplier_name    = serializers.CharField(source='supplier.name',    read_only=True)
    warehouse_name   = serializers.CharField(source='warehouse.name',   read_only=True, default='')
    received_by_name = serializers.CharField(source='received_by.get_full_name',
                                              read_only=True, default='')

    class Meta:
        model  = GoodsReceivedNote
        fields = [
            'id', 'grn_number', 'supplier', 'supplier_name',
            'po_reference', 'warehouse', 'warehouse_name',
            'received_date', 'status',
            'delivery_note_no', 'vehicle_number', 'driver_name',
            'total_items', 'total_value',
            'condition_notes', 'notes', 'lines',
            'received_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'grn_number', 'supplier_name', 'warehouse_name',
                            'total_items', 'total_value', 'received_by_name', 'created_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        grn        = GoodsReceivedNote.objects.create(**validated_data)
        total_val  = 0
        for line in lines_data:
            l = GRNLine.objects.create(grn=grn, **line)
            total_val += float(l.line_total)
        grn.total_items = len(lines_data)
        grn.total_value = round(total_val, 2)
        grn.save()
        return grn


class GRNListSerializer(serializers.ModelSerializer):
    supplier_name  = serializers.CharField(source='supplier.name',  read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default='')

    class Meta:
        model  = GoodsReceivedNote
        fields = ['id', 'grn_number', 'supplier_name', 'warehouse_name',
                  'po_reference', 'received_date', 'status',
                  'total_items', 'total_value', 'created_at']


class SupplierRatingSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    rated_by_name = serializers.CharField(source='rated_by.get_full_name',
                                           read_only=True, default='')

    class Meta:
        model  = SupplierRating
        fields = [
            'id', 'supplier', 'supplier_name', 'grn', 'po_reference', 'date',
            'quality_rating', 'delivery_rating', 'pricing_rating',
            'communication_rating', 'overall_rating', 'on_time_delivery',
            'comments', 'rated_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'overall_rating', 'supplier_name',
                            'rated_by_name', 'created_at']