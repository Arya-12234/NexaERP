from rest_framework import serializers
from .models import AssetCategory, Asset, DepreciationEntry, MaintenanceLog, AssetDisposal, AssetRevaluation


class AssetCategorySerializer(serializers.ModelSerializer):
    asset_count = serializers.SerializerMethodField()

    class Meta:
        model  = AssetCategory
        fields = [
            'id', 'name', 'description', 'depreciation_method',
            'default_useful_life_months', 'default_depreciation_rate',
            'gl_asset_account', 'gl_depreciation_account', 'gl_accumulated_account',
            'asset_count', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'asset_count']

    def get_asset_count(self, obj):
        return obj.assets.filter(status='Active').count()


class DepreciationEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model  = DepreciationEntry
        fields = ['id', 'period_year', 'period_month', 'amount',
                  'book_value_after', 'method_used', 'created_at']
        read_only_fields = fields


class MaintenanceLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MaintenanceLog
        fields = ['id', 'asset', 'maintenance_type', 'date', 'description',
                  'cost', 'vendor', 'performed_by', 'next_maintenance', 'created_at']
        read_only_fields = ['id', 'created_at']


class AssetDisposalSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AssetDisposal
        fields = ['id', 'disposal_method', 'disposal_date', 'proceeds',
                  'book_value_at_disposal', 'gain_loss', 'notes', 'created_at']
        read_only_fields = ['id', 'book_value_at_disposal', 'gain_loss', 'created_at']


class AssetRevaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AssetRevaluation
        fields = ['id', 'revaluation_date', 'previous_cost', 'new_cost',
                  'previous_accumulated', 'new_accumulated',
                  'revaluation_amount', 'reason', 'created_at']
        read_only_fields = ['id', 'previous_cost', 'previous_accumulated',
                            'revaluation_amount', 'created_at']


class AssetSerializer(serializers.ModelSerializer):
    book_value               = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    depreciation_percentage  = serializers.FloatField(read_only=True)
    is_fully_depreciated     = serializers.BooleanField(read_only=True)
    remaining_life_months    = serializers.IntegerField(read_only=True)
    category_name            = serializers.CharField(source='category.name', read_only=True)
    depreciation_entries     = DepreciationEntrySerializer(many=True, read_only=True)
    maintenance_logs         = MaintenanceLogSerializer(many=True, read_only=True)
    disposal                 = AssetDisposalSerializer(read_only=True)
    revaluations             = AssetRevaluationSerializer(many=True, read_only=True)
    total_maintenance_cost   = serializers.SerializerMethodField()

    class Meta:
        model  = Asset
        fields = [
            'id', 'asset_number', 'name', 'description',
            'category', 'category_name', 'serial_number', 'brand', 'model',
            'location', 'assigned_to', 'condition', 'status',
            'cost', 'salvage_value', 'purchase_date', 'in_service_date', 'disposal_date',
            'depreciation_method', 'useful_life_months', 'depreciation_rate',
            'accumulated_depreciation', 'book_value', 'depreciation_percentage',
            'is_fully_depreciated', 'remaining_life_months',
            'last_depreciation_date', 'supplier', 'purchase_order', 'warranty_expiry',
            'total_maintenance_cost',
            'depreciation_entries', 'maintenance_logs', 'disposal', 'revaluations',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'asset_number', 'accumulated_depreciation',
            'book_value', 'depreciation_percentage', 'is_fully_depreciated',
            'remaining_life_months', 'last_depreciation_date',
            'created_at', 'updated_at',
        ]

    def get_total_maintenance_cost(self, obj):
        return sum(m.cost for m in obj.maintenance_logs.all())


class AssetListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    book_value              = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    depreciation_percentage = serializers.FloatField(read_only=True)
    category_name           = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model  = Asset
        fields = [
            'id', 'asset_number', 'name', 'category_name', 'status',
            'cost', 'accumulated_depreciation', 'book_value',
            'depreciation_percentage', 'depreciation_method',
            'location', 'assigned_to', 'in_service_date',
        ]