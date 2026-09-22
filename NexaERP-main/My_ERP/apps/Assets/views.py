from django.shortcuts import render

# Create your views here.
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from .models import AssetCategory, Asset, DepreciationEntry, MaintenanceLog, AssetDisposal, AssetRevaluation
from .serializers import (
    AssetCategorySerializer, AssetSerializer, AssetListSerializer,
    DepreciationEntrySerializer, MaintenanceLogSerializer,
    AssetDisposalSerializer, AssetRevaluationSerializer,
)
from .depreciation import calculate_next_depreciation, calculate_disposal_gain_loss


def get_user(request):
    return request.user if request.user.is_authenticated else None


def get_gl_account(name_contains):
    try:
        from apps.Finance.models import Account
        return Account.objects.filter(name__icontains=name_contains, is_active=True).first()
    except Exception:
        return None


# ── Asset Categories ──────────────────────────────────────────

class AssetCategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = AssetCategorySerializer
    queryset         = AssetCategory.objects.all()


class AssetCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AssetCategorySerializer
    queryset         = AssetCategory.objects.all()


# ── Assets ────────────────────────────────────────────────────

class AssetListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return AssetSerializer if self.request.method == 'POST' else AssetListSerializer

    def get_queryset(self):
        qs = Asset.objects.select_related('category').all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if c := self.request.query_params.get('category'):
            qs = qs.filter(category_id=c)
        if m := self.request.query_params.get('method'):
            qs = qs.filter(depreciation_method=m)
        return qs


class AssetDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = AssetSerializer
    queryset         = Asset.objects.prefetch_related(
        'depreciation_entries', 'maintenance_logs',
        'disposal', 'revaluations'
    ).select_related('category').all()


# ── Run Monthly Depreciation ──────────────────────────────────

class DepreciateAssetView(APIView):
    """
    POST /api/assets/<id>/depreciate/

    Runs monthly depreciation for a single asset:
    1. Calculates charge using SLM or DBM
    2. Updates accumulated_depreciation on the asset
    3. Auto-posts GL journal entry:
       DR  Depreciation Expense
       CR  Accumulated Depreciation
    """
    @transaction.atomic
    def post(self, request, pk):
        asset = get_object_or_404(Asset, pk=pk)

        if asset.status != Asset.Status.ACTIVE:
            return Response(
                {'detail': f'Asset is {asset.status} — cannot depreciate.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if asset.is_fully_depreciated:
            return Response(
                {'detail': 'Asset is fully depreciated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.now().date()

        # Check if already depreciated this month
        if DepreciationEntry.objects.filter(
            asset=asset,
            period_year=today.year,
            period_month=today.month,
        ).exists():
            return Response(
                {'detail': f'Asset already depreciated for {today.strftime("%B %Y")}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        charge = calculate_next_depreciation(asset)

        if charge <= 0:
            return Response(
                {'detail': 'No depreciation to charge.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update asset
        asset.accumulated_depreciation += charge
        asset.last_depreciation_date    = today
        asset.save()

        # ── Post to GL ───────────────────────────────────────
        journal_entry = None
        try:
            from apps.Finance.models import Account, JournalEntry, JournalLine

            depr_exp_acc  = get_gl_account('Depreciation Expense')
            accum_depr_acc = get_gl_account('Accumulated Depreciation')

            if depr_exp_acc and accum_depr_acc:
                entry = JournalEntry.objects.create(
                    date        = today,
                    description = f'Depreciation — {asset.asset_number} {asset.name} ({today.strftime("%b %Y")})',
                    source      = JournalEntry.Source.ASSETS,
                    status      = JournalEntry.Status.DRAFT,
                    notes       = f'Auto-generated. Method: {asset.depreciation_method}',
                    created_by  = get_user(request),
                )
                JournalLine.objects.create(
                    entry=entry, account=depr_exp_acc,
                    debit=charge, credit=Decimal('0'),
                    description=f'Depreciation — {asset.name}',
                )
                JournalLine.objects.create(
                    entry=entry, account=accum_depr_acc,
                    debit=Decimal('0'), credit=charge,
                    description=f'Accumulated depreciation — {asset.name}',
                )
                entry.post()
                journal_entry = entry
        except Exception as e:
            pass  # GL posting failure doesn't block depreciation recording

        # Record depreciation entry
        depr_entry = DepreciationEntry.objects.create(
            asset            = asset,
            period_year      = today.year,
            period_month     = today.month,
            amount           = charge,
            book_value_after = asset.book_value,
            method_used      = asset.depreciation_method,
            journal_entry    = journal_entry,
        )

        return Response({
            'detail':          f'Depreciation of KES {charge} posted for {asset.asset_number}.',
            'charge':          charge,
            'book_value':      asset.book_value,
            'accumulated':     asset.accumulated_depreciation,
            'journal_entry_id': journal_entry.id if journal_entry else None,
        })


# ── Run Depreciation for ALL Active Assets ────────────────────

class DepreciateAllAssetsView(APIView):
    """
    POST /api/assets/depreciate-all/

    Runs monthly depreciation for ALL active, non-fully-depreciated assets.
    Used at month end.
    """
    @transaction.atomic
    def post(self, request):
        today  = timezone.now().date()
        assets = Asset.objects.filter(status=Asset.Status.ACTIVE)
        results = {'processed': [], 'skipped': [], 'errors': []}

        for asset in assets:
            if asset.is_fully_depreciated:
                results['skipped'].append(f'{asset.asset_number}: fully depreciated')
                continue

            if DepreciationEntry.objects.filter(
                asset=asset, period_year=today.year, period_month=today.month
            ).exists():
                results['skipped'].append(f'{asset.asset_number}: already depreciated this month')
                continue

            try:
                charge = calculate_next_depreciation(asset)
                if charge <= 0:
                    results['skipped'].append(f'{asset.asset_number}: zero charge')
                    continue

                asset.accumulated_depreciation += charge
                asset.last_depreciation_date    = today
                asset.save()

                DepreciationEntry.objects.create(
                    asset            = asset,
                    period_year      = today.year,
                    period_month     = today.month,
                    amount           = charge,
                    book_value_after = asset.book_value,
                    method_used      = asset.depreciation_method,
                )
                results['processed'].append(f'{asset.asset_number}: KES {charge}')

            except Exception as e:
                results['errors'].append(f'{asset.asset_number}: {str(e)}')

        # Post a single consolidated GL entry for all depreciation
        total_charge = sum(
            float(r.split('KES ')[1]) for r in results['processed'] if 'KES' in r
        )
        if total_charge > 0:
            try:
                from apps.Finance.models import Account, JournalEntry, JournalLine
                depr_exp_acc   = get_gl_account('Depreciation Expense')
                accum_depr_acc = get_gl_account('Accumulated Depreciation')
                if depr_exp_acc and accum_depr_acc:
                    entry = JournalEntry.objects.create(
                        date        = today,
                        description = f'Monthly depreciation run — {today.strftime("%B %Y")}',
                        source      = JournalEntry.Source.ASSETS,
                        status      = JournalEntry.Status.DRAFT,
                        created_by  = get_user(request),
                    )
                    JournalLine.objects.create(
                        entry=entry, account=depr_exp_acc,
                        debit=Decimal(str(round(total_charge, 2))), credit=Decimal('0'),
                    )
                    JournalLine.objects.create(
                        entry=entry, account=accum_depr_acc,
                        debit=Decimal('0'), credit=Decimal(str(round(total_charge, 2))),
                    )
                    entry.post()
            except Exception:
                pass

        return Response({
            'period':    today.strftime('%B %Y'),
            'processed': len(results['processed']),
            'skipped':   len(results['skipped']),
            'errors':    len(results['errors']),
            'total_depreciation': total_charge,
            'details':   results,
        })


# ── Depreciation Schedule ─────────────────────────────────────

class AssetScheduleView(APIView):
    """
    GET /api/assets/<id>/schedule/
    Returns the full projected depreciation schedule for an asset.
    """
    def get(self, request, pk):
        asset = get_object_or_404(Asset, pk=pk)
        from .depreciation import slm_schedule, dbm_schedule

        if asset.depreciation_method == Asset.DepreciationMethod.SLM:
            schedule = slm_schedule(
                asset.cost, asset.salvage_value,
                asset.useful_life_months,
                asset.accumulated_depreciation,
            )
        else:
            schedule = dbm_schedule(
                asset.cost, asset.salvage_value,
                asset.useful_life_months,
                asset.depreciation_rate,
                asset.accumulated_depreciation,
            )

        return Response({
            'asset_number':   asset.asset_number,
            'name':           asset.name,
            'method':         asset.depreciation_method,
            'cost':           asset.cost,
            'salvage_value':  asset.salvage_value,
            'book_value':     asset.book_value,
            'accumulated':    asset.accumulated_depreciation,
            'schedule':       schedule,
        })


# ── Asset Disposal ────────────────────────────────────────────

class AssetDisposalView(APIView):
    """
    POST /api/assets/<id>/dispose/

    Disposes an asset:
    1. Calculates gain or loss
    2. Marks asset as Disposed
    3. Posts GL journal entry:
       DR  Accumulated Depreciation  (remove contra-asset)
       DR  Cash/Receivable           (proceeds received)
       DR  Loss on Disposal          (if loss)
       CR  Fixed Asset Account       (remove asset cost)
       CR  Gain on Disposal          (if gain)
    """
    @transaction.atomic
    def post(self, request, pk):
        asset = get_object_or_404(Asset, pk=pk)

        if asset.status != Asset.Status.ACTIVE:
            return Response(
                {'detail': f'Asset is already {asset.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if hasattr(asset, 'disposal'):
            return Response(
                {'detail': 'Asset has already been disposed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        disposal_method = request.data.get('disposal_method', 'Sale')
        proceeds        = Decimal(str(request.data.get('proceeds', 0)))
        notes           = request.data.get('notes', '')
        disposal_date   = request.data.get('disposal_date', timezone.now().date().isoformat())

        book_value = asset.book_value
        gain_loss  = calculate_disposal_gain_loss(asset, proceeds)

        # Create disposal record
        disposal = AssetDisposal.objects.create(
            asset                  = asset,
            disposal_method        = disposal_method,
            disposal_date          = disposal_date,
            proceeds               = proceeds,
            book_value_at_disposal = book_value,
            gain_loss              = gain_loss,
            notes                  = notes,
        )

        # Mark asset as disposed
        asset.status       = Asset.Status.DISPOSED
        asset.disposal_date = disposal_date
        asset.save()

        # ── Post GL ──────────────────────────────────────────
        journal_entry = None
        try:
            from apps.Finance.models import Account, JournalEntry, JournalLine

            fixed_asset_acc  = get_gl_account('Fixed Assets')
            accum_depr_acc   = get_gl_account('Accumulated Depreciation')
            cash_acc         = get_gl_account('Cash')
            other_income_acc = get_gl_account('Other Income')

            if fixed_asset_acc and accum_depr_acc:
                entry = JournalEntry.objects.create(
                    date        = disposal_date,
                    description = f'Asset disposal — {asset.asset_number} {asset.name}',
                    source      = JournalEntry.Source.ASSETS,
                    status      = JournalEntry.Status.DRAFT,
                    notes       = f'Disposal method: {disposal_method}. Gain/Loss: KES {gain_loss}',
                    created_by  = get_user(request),
                )
                lines = []

                # Remove accumulated depreciation (DR — reduces contra-asset)
                if asset.accumulated_depreciation > 0:
                    lines.append(JournalLine(
                        entry=entry, account=accum_depr_acc,
                        debit=asset.accumulated_depreciation, credit=Decimal('0'),
                        description='Remove accumulated depreciation',
                    ))

                # Record proceeds received
                if proceeds > 0 and cash_acc:
                    lines.append(JournalLine(
                        entry=entry, account=cash_acc,
                        debit=proceeds, credit=Decimal('0'),
                        description='Disposal proceeds received',
                    ))

                # Remove asset at cost (CR)
                lines.append(JournalLine(
                    entry=entry, account=fixed_asset_acc,
                    debit=Decimal('0'), credit=asset.cost,
                    description='Remove asset at cost',
                ))

                # Record gain or loss
                if gain_loss > 0 and other_income_acc:
                    lines.append(JournalLine(
                        entry=entry, account=other_income_acc,
                        debit=Decimal('0'), credit=gain_loss,
                        description='Gain on disposal',
                    ))
                elif gain_loss < 0:
                    loss_acc = get_gl_account('Other Income') or cash_acc
                    if loss_acc:
                        lines.append(JournalLine(
                            entry=entry, account=loss_acc,
                            debit=abs(gain_loss), credit=Decimal('0'),
                            description='Loss on disposal',
                        ))

                JournalLine.objects.bulk_create(lines)
                entry.post()
                journal_entry = entry
                disposal.journal_entry = journal_entry
                disposal.save()

        except Exception as e:
            pass

        return Response({
            'detail':              f'{asset.asset_number} disposed successfully.',
            'disposal_method':     disposal_method,
            'proceeds':            proceeds,
            'book_value':          book_value,
            'gain_loss':           gain_loss,
            'result':              'Gain' if gain_loss > 0 else ('Loss' if gain_loss < 0 else 'Break-even'),
            'journal_entry_id':    journal_entry.id if journal_entry else None,
        })


# ── Asset Revaluation ─────────────────────────────────────────

class AssetRevaluationView(APIView):
    """
    POST /api/assets/<id>/revalue/

    Revalues an asset upward or downward.
    Upward:   DR Fixed Assets / CR Revaluation Surplus (Equity)
    Downward: DR Impairment Loss / CR Fixed Assets
    """
    @transaction.atomic
    def post(self, request, pk):
        asset    = get_object_or_404(Asset, pk=pk)
        new_cost = Decimal(str(request.data.get('new_cost', 0)))
        reason   = request.data.get('reason', '')

        if new_cost <= 0:
            return Response({'detail': 'New cost must be positive.'}, status=status.HTTP_400_BAD_REQUEST)
        if not reason:
            return Response({'detail': 'Revaluation reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        previous_cost        = asset.cost
        previous_accumulated = asset.accumulated_depreciation
        revaluation_amount   = new_cost - previous_cost

        # Adjust accumulated depreciation proportionally
        if previous_cost > 0:
            ratio = new_cost / previous_cost
            new_accumulated = previous_accumulated * ratio
        else:
            new_accumulated = previous_accumulated

        # Record revaluation
        revaluation = AssetRevaluation.objects.create(
            asset                = asset,
            revaluation_date     = timezone.now().date(),
            previous_cost        = previous_cost,
            new_cost             = new_cost,
            previous_accumulated = previous_accumulated,
            new_accumulated      = new_accumulated,
            revaluation_amount   = revaluation_amount,
            reason               = reason,
        )

        # Update asset
        asset.cost                     = new_cost
        asset.accumulated_depreciation = new_accumulated
        asset.save()

        return Response({
            'detail':            f'{asset.asset_number} revalued successfully.',
            'previous_cost':     previous_cost,
            'new_cost':          new_cost,
            'revaluation_amount':revaluation_amount,
            'direction':         'Upward' if revaluation_amount > 0 else 'Downward',
            'new_book_value':    asset.book_value,
        })


# ── Maintenance ───────────────────────────────────────────────

class MaintenanceListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/assets/<id>/maintenance/
    POST /api/assets/<id>/maintenance/
    """
    serializer_class = MaintenanceLogSerializer

    def get_queryset(self):
        asset = get_object_or_404(Asset, pk=self.kwargs['pk'])
        return asset.maintenance_logs.all()

    @transaction.atomic
    def perform_create(self, serializer):
        asset = get_object_or_404(Asset, pk=self.kwargs['pk'])
        log   = serializer.save(asset=asset)

        # Auto-post maintenance cost to GL
        try:
            from apps.Finance.models import Account, JournalEntry, JournalLine
            repair_acc = get_gl_account('Office Supplies') or get_gl_account('Utilities')
            cash_acc   = get_gl_account('Cash')
            if repair_acc and cash_acc:
                entry = JournalEntry.objects.create(
                    date        = log.date,
                    description = f'Maintenance — {asset.asset_number}: {log.description[:80]}',
                    source      = JournalEntry.Source.ASSETS,
                    status      = JournalEntry.Status.DRAFT,
                )
                JournalLine.objects.create(entry=entry, account=repair_acc,
                    debit=log.cost, credit=Decimal('0'))
                JournalLine.objects.create(entry=entry, account=cash_acc,
                    debit=Decimal('0'), credit=log.cost)
                entry.post()
                log.journal_entry = entry
                log.save()
        except Exception:
            pass


# ── Portfolio Summary ─────────────────────────────────────────

class AssetSummaryView(APIView):
    """
    GET /api/assets/summary/
    Portfolio-level summary of all assets.
    """
    def get(self, request):
        assets        = Asset.objects.select_related('category').all()
        active        = assets.filter(status=Asset.Status.ACTIVE)
        disposed      = assets.filter(status=Asset.Status.DISPOSED)

        total_cost    = sum(a.cost                     for a in active)
        total_accum   = sum(a.accumulated_depreciation for a in active)
        total_book    = sum(a.book_value               for a in active)
        total_maint   = sum(
            sum(m.cost for m in a.maintenance_logs.all()) for a in active
        )

        by_category = {}
        for a in active:
            cat = a.category.name
            if cat not in by_category:
                by_category[cat] = {'count': 0, 'cost': 0, 'book_value': 0}
            by_category[cat]['count']      += 1
            by_category[cat]['cost']       += float(a.cost)
            by_category[cat]['book_value'] += float(a.book_value)

        by_method = {
            'SLM': active.filter(depreciation_method='SLM').count(),
            'DBM': active.filter(depreciation_method='DBM').count(),
        }

        return Response({
            'active_assets':          active.count(),
            'disposed_assets':        disposed.count(),
            'fully_depreciated':      sum(1 for a in active if a.is_fully_depreciated),
            'total_cost':             total_cost,
            'total_accumulated_depr': total_accum,
            'total_book_value':       total_book,
            'total_maintenance_cost': total_maint,
            'depreciation_ratio':     round(float(total_accum) / float(total_cost) * 100, 1) if total_cost else 0,
            'by_category':            by_category,
            'by_method':              by_method,
        })