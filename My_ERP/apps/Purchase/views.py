from django.shortcuts import render

# Create your views here.
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from .models import (
    Supplier, PurchaseRequisition, RequisitionLine,
    PurchaseBudget, GoodsReceivedNote, GRNLine, SupplierRating,
)
from .serializers import (
    SupplierSerializer, SupplierListSerializer,
    PurchaseRequisitionSerializer, PurchaseRequisitionListSerializer,
    PurchaseBudgetSerializer,
    GoodsReceivedNoteSerializer, GRNListSerializer,
    SupplierRatingSerializer,
)


def get_user(request):
    return request.user if request.user.is_authenticated else None


# ── Suppliers ─────────────────────────────────────────────────

class SupplierListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return SupplierSerializer if self.request.method == 'POST' else SupplierListSerializer

    def get_queryset(self):
        qs = Supplier.objects.all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if t := self.request.query_params.get('supplier_type'):
            qs = qs.filter(supplier_type=t)
        if q := self.request.query_params.get('search'):
            qs = qs.filter(name__icontains=q)
        return qs


class SupplierDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = SupplierSerializer
    queryset         = Supplier.objects.all()


class SupplierRatingsView(APIView):
    """GET /api/purchase/suppliers/<id>/ratings/"""
    def get(self, request, pk):
        supplier = get_object_or_404(Supplier, pk=pk)
        ratings  = supplier.ratings.all()
        return Response({
            'supplier':           SupplierSerializer(supplier).data,
            'ratings':            SupplierRatingSerializer(ratings, many=True).data,
            'average_rating':     supplier.average_rating,
            'on_time_pct':        supplier.on_time_delivery_pct,
            'total_ratings':      ratings.count(),
        })


# ── Purchase Requisitions ─────────────────────────────────────

class RequisitionListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return PurchaseRequisitionSerializer if self.request.method == 'POST' \
               else PurchaseRequisitionListSerializer

    def get_queryset(self):
        qs = PurchaseRequisition.objects.all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if d := self.request.query_params.get('department'):
            qs = qs.filter(department__icontains=d)
        if p := self.request.query_params.get('priority'):
            qs = qs.filter(priority=p)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=get_user(self.request))


class RequisitionDetailView(generics.RetrieveAPIView):
    serializer_class = PurchaseRequisitionSerializer
    queryset         = PurchaseRequisition.objects.prefetch_related('lines').all()


class SubmitRequisitionView(APIView):
    """POST /api/purchase/requisitions/<id>/submit/"""
    def post(self, request, pk):
        pr = get_object_or_404(PurchaseRequisition, pk=pk)
        if pr.status != PurchaseRequisition.Status.DRAFT:
            return Response({'detail': 'Only Draft requisitions can be submitted.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not pr.lines.exists():
            return Response({'detail': 'Add at least one line before submitting.'},
                            status=status.HTTP_400_BAD_REQUEST)
        pr.status       = PurchaseRequisition.Status.SUBMITTED
        pr.submitted_at = timezone.now()
        pr.save()
        return Response({'detail': f'{pr.pr_number} submitted for approval.', 'status': pr.status})


class ApproveRequisitionView(APIView):
    """POST /api/purchase/requisitions/<id>/approve/"""
    def post(self, request, pk):
        pr = get_object_or_404(PurchaseRequisition, pk=pk)
        if pr.status != PurchaseRequisition.Status.SUBMITTED:
            return Response({'detail': 'Requisition must be Submitted before approval.'},
                            status=status.HTTP_400_BAD_REQUEST)
        pr.status      = PurchaseRequisition.Status.APPROVED
        pr.approved_by = get_user(request)
        pr.approved_at = timezone.now()
        pr.save()
        return Response({'detail': f'{pr.pr_number} approved.', 'status': pr.status})


class RejectRequisitionView(APIView):
    """POST /api/purchase/requisitions/<id>/reject/"""
    def post(self, request, pk):
        pr     = get_object_or_404(PurchaseRequisition, pk=pk)
        reason = request.data.get('reason', '').strip()
        if pr.status not in (PurchaseRequisition.Status.SUBMITTED,):
            return Response({'detail': 'Only Submitted requisitions can be rejected.'},
                            status=status.HTTP_400_BAD_REQUEST)
        pr.status           = PurchaseRequisition.Status.REJECTED
        pr.rejection_reason = reason
        pr.save()
        return Response({'detail': f'{pr.pr_number} rejected.', 'status': pr.status})


class ConvertRequisitionView(APIView):
    """POST /api/purchase/requisitions/<id>/convert/ — convert to Orders PO"""
    def post(self, request, pk):
        pr = get_object_or_404(PurchaseRequisition, pk=pk)
        if pr.status != PurchaseRequisition.Status.APPROVED:
            return Response({'detail': 'Only Approved requisitions can be converted to PO.'},
                            status=status.HTTP_400_BAD_REQUEST)
        pr.status = PurchaseRequisition.Status.CONVERTED
        pr.save()
        return Response({
            'detail': f'{pr.pr_number} marked as converted. Create a PO in the Orders module.',
            'status': pr.status,
        })


# ── Purchase Budgets ──────────────────────────────────────────

class BudgetListCreateView(generics.ListCreateAPIView):
    serializer_class = PurchaseBudgetSerializer

    def get_queryset(self):
        qs = PurchaseBudget.objects.all()
        if d := self.request.query_params.get('department'):
            qs = qs.filter(department__icontains=d)
        if y := self.request.query_params.get('year'):
            qs = qs.filter(year=y)
        return qs


class BudgetDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = PurchaseBudgetSerializer
    queryset         = PurchaseBudget.objects.all()


class BudgetSummaryView(APIView):
    """GET /api/purchase/budgets/summary/"""
    def get(self, request):
        today   = timezone.now().date()
        budgets = PurchaseBudget.objects.filter(year=today.year)

        total_budget = sum(b.budget_amount for b in budgets)
        total_spent  = sum(b.spent_amount  for b in budgets)
        over_budget  = [b for b in budgets if b.is_over_budget]

        dept_summary = {}
        for b in budgets:
            if b.department not in dept_summary:
                dept_summary[b.department] = {'budget': 0, 'spent': 0}
            dept_summary[b.department]['budget'] += float(b.budget_amount)
            dept_summary[b.department]['spent']  += float(b.spent_amount)

        return Response({
            'year':          today.year,
            'total_budget':  total_budget,
            'total_spent':   total_spent,
            'total_remaining': total_budget - total_spent,
            'over_budget_count': len(over_budget),
            'utilization_pct': round(float(total_spent) / float(total_budget) * 100, 1)
                               if total_budget > 0 else 0,
            'by_department': [
                {
                    'department': dept,
                    'budget':     v['budget'],
                    'spent':      v['spent'],
                    'remaining':  v['budget'] - v['spent'],
                    'utilization_pct': round(v['spent'] / v['budget'] * 100, 1)
                                       if v['budget'] > 0 else 0,
                }
                for dept, v in dept_summary.items()
            ],
        })


# ── Goods Received Notes ──────────────────────────────────────

class GRNListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return GoodsReceivedNoteSerializer if self.request.method == 'POST' \
               else GRNListSerializer

    def get_queryset(self):
        qs = GoodsReceivedNote.objects.select_related('supplier', 'warehouse').all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if sup := self.request.query_params.get('supplier'):
            qs = qs.filter(supplier_id=sup)
        return qs

    def perform_create(self, serializer):
        serializer.save(received_by=get_user(self.request))


class GRNDetailView(generics.RetrieveAPIView):
    serializer_class = GoodsReceivedNoteSerializer
    queryset         = GoodsReceivedNote.objects.prefetch_related('lines__product').all()


class ConfirmGRNView(APIView):
    """POST /api/purchase/grns/<id>/confirm/"""
    def post(self, request, pk):
        grn = get_object_or_404(GoodsReceivedNote, pk=pk)
        if grn.status != GoodsReceivedNote.Status.DRAFT:
            return Response({'detail': 'Only Draft GRNs can be confirmed.'},
                            status=status.HTTP_400_BAD_REQUEST)
        grn.status = GoodsReceivedNote.Status.CONFIRMED
        grn.save()
        return Response({'detail': f'{grn.grn_number} confirmed.', 'status': grn.status})


class PostGRNView(APIView):
    """
    POST /api/purchase/grns/<id>/post/
    Posts GRN to inventory — updates stock levels.
    """
    @transaction.atomic
    def post(self, request, pk):
        grn = get_object_or_404(GoodsReceivedNote, pk=pk)
        if grn.status != GoodsReceivedNote.Status.CONFIRMED:
            return Response({'detail': 'GRN must be Confirmed before posting.'},
                            status=status.HTTP_400_BAD_REQUEST)

        posted = []
        errors = []

        if grn.warehouse:
            try:
                from apps.Inventory.models import WarehouseInventory, StockMovement, FIFOLayer
                from apps.Inventory.views  import get_or_create_inventory, update_wac

                for line in grn.lines.filter(product__isnull=False,
                                              condition='Good'):
                    product = line.product
                    if not product.track_stock:
                        continue

                    inv       = get_or_create_inventory(product, grn.warehouse)
                    qty_before= inv.quantity_on_hand

                    if product.valuation_method == 'WAC':
                        update_wac(product, line.quantity_received, line.unit_cost)
                    elif product.valuation_method == 'FIFO':
                        FIFOLayer.objects.create(
                            product=product, warehouse=grn.warehouse,
                            receipt_date=grn.received_date,
                            quantity_in=line.quantity_received,
                            quantity_remaining=line.quantity_received,
                            unit_cost=line.unit_cost,
                            source_ref=grn.grn_number,
                        )

                    inv.quantity_on_hand += line.quantity_received
                    inv.save()

                    total_cost = (Decimal(str(line.quantity_received)) *
                                  Decimal(str(line.unit_cost))).quantize(Decimal('0.01'))

                    StockMovement.objects.create(
                        product        = product,
                        warehouse      = grn.warehouse,
                        movement_type  = 'Receipt',
                        quantity       = line.quantity_received,
                        unit_cost      = line.unit_cost,
                        total_cost     = total_cost,
                        quantity_before= qty_before,
                        quantity_after = inv.quantity_on_hand,
                        date           = grn.received_date,
                        source_ref     = grn.grn_number,
                        notes          = f'Posted from GRN {grn.grn_number}',
                        created_by     = get_user(request),
                    )
                    posted.append(product.sku)
            except Exception as e:
                errors.append(str(e))

        grn.status = GoodsReceivedNote.Status.POSTED
        grn.save()

        # Update supplier total orders & spend
        grn.supplier.total_orders += 1
        grn.supplier.total_spend  += grn.total_value
        grn.supplier.save()

        return Response({
            'detail':  f'{grn.grn_number} posted to inventory.',
            'status':  grn.status,
            'posted':  posted,
            'errors':  errors,
        })


# ── Supplier Ratings ──────────────────────────────────────────

class SupplierRatingListCreateView(generics.ListCreateAPIView):
    serializer_class = SupplierRatingSerializer

    def get_queryset(self):
        qs = SupplierRating.objects.select_related('supplier').all()
        if s := self.request.query_params.get('supplier'):
            qs = qs.filter(supplier_id=s)
        return qs

    def perform_create(self, serializer):
        serializer.save(rated_by=get_user(self.request))


# ── Purchase Dashboard ────────────────────────────────────────

class PurchaseDashboardView(APIView):
    """GET /api/purchase/dashboard/"""
    def get(self, request):
        today = timezone.now().date()

        suppliers = Supplier.objects.filter(status='Active')
        prs       = PurchaseRequisition.objects.all()
        grns      = GoodsReceivedNote.objects.all()
        budgets   = PurchaseBudget.objects.filter(year=today.year)

        total_budget = sum(b.budget_amount for b in budgets)
        total_spent  = sum(b.spent_amount  for b in budgets)

        top_suppliers = list(
            Supplier.objects.filter(status='Active')
            .order_by('-total_spend')[:5]
            .values('name', 'total_spend', 'average_rating', 'on_time_delivery_pct')
        )

        return Response({
            'active_suppliers':      suppliers.count(),
            'pending_requisitions':  prs.filter(status__in=['Draft', 'Submitted']).count(),
            'approved_requisitions': prs.filter(status='Approved').count(),
            'grns_this_month':       grns.filter(
                received_date__year=today.year,
                received_date__month=today.month,
            ).count(),
            'total_budget':          total_budget,
            'total_spent':           total_spent,
            'budget_remaining':      total_budget - total_spent,
            'budget_utilization':    round(float(total_spent) / float(total_budget) * 100, 1)
                                     if total_budget > 0 else 0,
            'top_suppliers':         top_suppliers,
            'avg_supplier_rating':   round(
                float(sum(s.average_rating for s in suppliers.filter(average_rating__gt=0)))
                / max(suppliers.filter(average_rating__gt=0).count(), 1), 1
            ),
        })


# ── Analytics ─────────────────────────────────────────────────

class PurchaseAnalyticsView(APIView):
    """GET /api/purchase/analytics/"""
    def get(self, request):
        today = timezone.now().date()

        # Spend by supplier (top 10)
        spend_by_supplier = list(
            Supplier.objects.filter(total_spend__gt=0)
            .order_by('-total_spend')[:10]
            .values('name', 'total_spend', 'total_orders', 'average_rating')
        )

        # Monthly GRN value (last 6 months)
        monthly_grn = []
        for i in range(5, -1, -1):
            m   = today.month - i
            y   = today.year
            while m <= 0:
                m += 12; y -= 1
            grns = GoodsReceivedNote.objects.filter(
                received_date__year=y,
                received_date__month=m,
                status='Posted',
            )
            monthly_grn.append({
                'month': f'{y}-{m:02d}',
                'value': sum(g.total_value for g in grns),
                'count': grns.count(),
            })

        # Requisition status breakdown
        pr_breakdown = {
            s: PurchaseRequisition.objects.filter(status=s).count()
            for s in ['Draft', 'Submitted', 'Approved', 'Rejected', 'Converted']
        }

        # Budget utilization by department
        budget_by_dept = list(
            PurchaseBudget.objects.filter(year=today.year)
            .values('department')
        )

        return Response({
            'spend_by_supplier': spend_by_supplier,
            'monthly_grn':       monthly_grn,
            'pr_breakdown':      pr_breakdown,
            'top_categories':    [],
        })