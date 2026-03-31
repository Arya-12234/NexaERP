from rest_framework import serializers
from .models import Account, JournalEntry, JournalLine
from decimal import Decimal


class AccountSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )

    class Meta:
        model  = Account
        fields = [
            'id', 'code', 'name', 'account_type',
            'description', 'is_active', 'balance', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'balance']


class JournalLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model  = JournalLine
        fields = [
            'id', 'account', 'account_code', 'account_name',
            'description', 'debit', 'credit',
        ]
        read_only_fields = ['id', 'account_code', 'account_name']


class JournalEntrySerializer(serializers.ModelSerializer):
    lines          = JournalLineSerializer(many=True)
    total_debits   = serializers.DecimalField(
        source='get_total_debits', max_digits=15, decimal_places=2, read_only=True
    )
    total_credits  = serializers.DecimalField(
        source='get_total_credits', max_digits=15, decimal_places=2, read_only=True
    )
    is_balanced    = serializers.BooleanField(read_only=True)
    created_by_username = serializers.CharField(
        source='created_by.username', read_only=True, default=None
    )

    class Meta:
        model  = JournalEntry
        fields = [
            'id', 'reference', 'date', 'description', 'source',
            'status', 'notes', 'lines',
            'total_debits', 'total_credits', 'is_balanced',
            'created_by', 'created_by_username', 'created_at', 'posted_at',
        ]
        read_only_fields = [
            'id', 'reference', 'status', 'created_at', 'posted_at',
            'total_debits', 'total_credits', 'is_balanced',
            'created_by_username',
        ]

    def validate_lines(self, lines):
        if len(lines) < 2:
            raise serializers.ValidationError(
                'A journal entry must contain at least 2 lines.'
            )

        total_debit  = sum(Decimal(str(l.get('debit',  0))) for l in lines)
        total_credit = sum(Decimal(str(l.get('credit', 0))) for l in lines)

        if total_debit != total_credit:
            raise serializers.ValidationError(
                f'Entry is not balanced. '
                f'Total debits ({total_debit}) ≠ total credits ({total_credit}).'
            )

        for line in lines:
            d = Decimal(str(line.get('debit',  0)))
            c = Decimal(str(line.get('credit', 0)))
            if d > 0 and c > 0:
                raise serializers.ValidationError(
                    'A single line cannot carry both a debit and a credit.'
                )
            if d == 0 and c == 0:
                raise serializers.ValidationError(
                    'Each line must have a non-zero debit or credit.'
                )

        return lines

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        entry = JournalEntry.objects.create(**validated_data)
        for line in lines_data:
            JournalLine.objects.create(entry=entry, **line)
        return entry


class JournalEntryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — excludes lines for performance."""
    total_debits  = serializers.DecimalField(
        source='get_total_debits', max_digits=15, decimal_places=2, read_only=True
    )
    is_balanced   = serializers.BooleanField(read_only=True)

    class Meta:
        model  = JournalEntry
        fields = [
            'id', 'reference', 'date', 'description',
            'source', 'status', 'total_debits', 'is_balanced', 'created_at',
        ]


class TrialBalanceRowSerializer(serializers.Serializer):
    code         = serializers.CharField()
    name         = serializers.CharField()
    account_type = serializers.CharField()
    debit        = serializers.DecimalField(max_digits=15, decimal_places=2)
    credit       = serializers.DecimalField(max_digits=15, decimal_places=2)