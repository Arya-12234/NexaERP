from django.shortcuts import render

# Create your views here.
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import models, transaction
from django.utils import timezone
from decimal import Decimal

from .models import (
    Quotation, QuotationLine,
    SalesOrder, SalesOrderLine,
    PurchaseOrder, PurchaseOrderLine,
    Delivery, DeliveryLine,
)
from .serializers import (
    QuotationSerializer, QuotationListSerializer,
    SalesOrderSerializer, SalesOrderListSerializer,
    PurchaseOrderSerializer, PurchaseOrderListSerializer,
    DeliverySerializer, DeliveryListSerializer,
)


def get_user(request):
    return request.user if request.user.is_authenticated else None


def get_gl_account(name_contains):
    try:
        from apps.Finance.models import Account
        return Account.objects.filter(name__icontains=name_contains, is_active=True).first()
    except Exception:
        return None


# ── Quotations ────────────────────────────────────────────────

class QuotationListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return QuotationSerializer if self.request.method == 'POST' else QuotationListSerializer

    def get_queryset(self):
        qs = Quotation.objects.all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if c := self.request.query_params.get('customer'):
            qs = qs.filter(customer__icontains=c)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=get_user(self.request))


class QuotationDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = QuotationSerializer
    queryset         = Quotation.objects.prefetch_related('lines').all()


class SendQuotationView(APIView):
    """POST /api/orders/quotations/<id>/send/"""
    def post(self, request, pk):
        qt = get_object_or_404(Quotation, pk=pk)
        if qt.status != Quotation.Status.DRAFT:
            return Response({'detail': 'Only Draft quotations can be sent.'},
                            status=status.HTTP_400_BAD_REQUEST)
        qt.status = Quotation.Status.SENT
        qt.save()
        return Response({'detail': f'{qt.quotation_number} sent to {qt.customer}.', 'status': qt.status})


class ConvertQuotationView(APIView):
    """
    POST /api/orders/quotations/<id>/convert/
    Converts an accepted quotation into a Sales Order.
    """
    @transaction.atomic
    def post(self, request, pk):
        qt = get_object_or_404(Quotation, pk=pk)
        if qt.status not in (Quotation.Status.SENT, Quotation.Status.DRAFT):
            return Response({'detail': f'Cannot convert a {qt.status} quotation.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Create Sales Order from Quotation
        order = SalesOrder.objects.create(
            quotation       = qt,
            customer        = qt.customer,
            customer_email  = qt.customer_email,
            customer_phone  = qt.customer_phone,
            order_date      = timezone.now().date(),
            subtotal        = qt.subtotal,
            vat_amount      = qt.vat_amount,
            discount_amount = qt.discount_amount,
            total_amount    = qt.total_amount,
            status          = SalesOrder.Status.CONFIRMED,
            notes           = qt.notes,
            created_by      = get_user(request),
        )

        # Copy lines
        for line in qt.lines.all():
            SalesOrderLine.objects.create(
                order       = order,
                product     = line.product,
                description = line.description,
                quantity    = line.quantity,
                unit_price  = line.unit_price,
                vat_rate    = line.vat_rate,
            )

        qt.status = Quotation.Status.ACCEPTED
        qt.save()

        return Response({
            'detail':       f'Quotation {qt.quotation_number} converted to Sales Order.',
            'order_number': order.order_number,
            'order_id':     order.id,
        }, status=status.HTTP_201_CREATED)


# ── Sales Orders ──────────────────────────────────────────────

class SalesOrderListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return SalesOrderSerializer if self.request.method == 'POST' else SalesOrderListSerializer

    def get_queryset(self):
        qs = SalesOrder.objects.select_related('warehouse').all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if c := self.request.query_params.get('customer'):
            qs = qs.filter(customer__icontains=c)
        if self.request.query_params.get('overdue') == 'true':
            qs = qs.filter(
                status__in=[SalesOrder.Status.CONFIRMED, SalesOrder.Status.APPROVED,
                            SalesOrder.Status.PROCESSING],
                requested_date__lt=timezone.now().date(),
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=get_user(request := self.request))


class SalesOrderDetailView(generics.RetrieveAPIView):
    serializer_class = SalesOrderSerializer
    queryset         = SalesOrder.objects.prefetch_related('lines__product').all()


class ConfirmSalesOrderView(APIView):
    """POST /api/orders/sales/<id>/confirm/"""
    def post(self, request, pk):
        order = get_object_or_404(SalesOrder, pk=pk)
        if order.status != SalesOrder.Status.PENDING:
            return Response({'detail': 'Only Pending orders can be confirmed.'},
                            status=status.HTTP_400_BAD_REQUEST)
        order.status         = SalesOrder.Status.CONFIRMED
        order.confirmed_date = timezone.now().date()
        order.save()
        return Response({'detail': f'{order.order_number} confirmed.', 'status': order.status})


class ApproveSalesOrderView(APIView):
    """
    POST /api/orders/sales/<id>/approve/
    Approves order and optionally creates AR invoice.
    """
    @transaction.atomic
    def post(self, request, pk):
        order = get_object_or_404(SalesOrder, pk=pk)
        if order.status != SalesOrder.Status.CONFIRMED:
            return Response({'detail': 'Order must be Confirmed before approval.'},
                            status=status.HTTP_400_BAD_REQUEST)

        order.status      = SalesOrder.Status.APPROVED
        order.approved_by = get_user(request)
        order.approved_at = timezone.now()
        order.save()

        # Auto-create AR Invoice if ar_customer is linked
        ar_invoice = None
        if order.ar_customer:
            try:
                from apps.AR.models import Invoice, InvoiceLine
                invoice = Invoice.objects.create(
                    customer      = order.ar_customer,
                    invoice_type  = 'Invoice',
                    invoice_date  = timezone.now().date(),
                    due_date      = timezone.now().date() + timezone.timedelta(
                        days=order.ar_customer.payment_terms_days
                    ),
                    subtotal      = order.subtotal,
                    vat_amount    = order.vat_amount,
                    total_amount  = order.total_amount,
                    status        = 'Draft',
                    notes         = f'Auto-created from {order.order_number}',
                    created_by    = get_user(request),
                )
                for line in order.lines.all():
                    InvoiceLine.objects.create(
                        invoice     = invoice,
                        description = line.description,
                        quantity    = line.quantity,
                        unit_price  = line.unit_price,
                        vat_rate    = line.vat_rate,
                        gl_account  = None,
                    )
                order.ar_invoice = invoice
                order.save()
                ar_invoice = invoice
            except Exception:
                pass

        return Response({
            'detail':     f'{order.order_number} approved.',
            'status':     order.status,
            'ar_invoice': ar_invoice.invoice_number if ar_invoice else None,
        })


class ProcessSalesOrderView(APIView):
    """
    POST /api/orders/sales/<id>/process/
    Marks order as Processing and auto-deducts stock from warehouse.
    """
    @transaction.atomic
    def post(self, request, pk):
        order = get_object_or_404(SalesOrder, pk=pk)
        if order.status != SalesOrder.Status.APPROVED:
            return Response({'detail': 'Order must be Approved before processing.'},
                            status=status.HTTP_400_BAD_REQUEST)

        stock_errors = []

        # Deduct stock for each line with a product
        if order.warehouse:
            try:
                from apps.Inventory.models import WarehouseInventory, StockMovement
                from apps.Inventory.views import get_or_create_inventory, consume_fifo
                from decimal import Decimal as D

                for line in order.lines.filter(product__isnull=False):
                    product = line.product
                    if not product.track_stock:
                        continue

                    inv = get_or_create_inventory(product, order.warehouse)
                    if inv.quantity_on_hand < line.quantity:
                        stock_errors.append(
                            f'{product.sku}: insufficient stock '
                            f'(available: {inv.quantity_on_hand}, needed: {line.quantity})'
                        )
                        continue

                    qty_before = inv.quantity_on_hand

                    # FIFO or WAC
                    if product.valuation_method == 'FIFO':
                        unit_cost = consume_fifo(product, order.warehouse, line.quantity)
                    else:
                        unit_cost = product.cost_price

                    inv.quantity_on_hand -= line.quantity
                    inv.save()

                    total_cost = (D(str(line.quantity)) * D(str(unit_cost))).quantize(D('0.01'))

                    StockMovement.objects.create(
                        product        = product,
                        warehouse      = order.warehouse,
                        movement_type  = 'Issue',
                        quantity       = line.quantity,
                        unit_cost      = unit_cost,
                        total_cost     = total_cost,
                        quantity_before= qty_before,
                        quantity_after = inv.quantity_on_hand,
                        date           = timezone.now().date(),
                        source_ref     = order.order_number,
                        notes          = f'Auto-issued for {order.order_number}',
                        created_by     = get_user(request),
                    )
            except Exception as e:
                stock_errors.append(str(e))

        order.status = SalesOrder.Status.PROCESSING
        order.save()

        return Response({
            'detail':       f'{order.order_number} is now Processing.',
            'status':       order.status,
            'stock_errors': stock_errors,
        })


class ShipSalesOrderView(APIView):
    """POST /api/orders/sales/<id>/ship/"""
    def post(self, request, pk):
        order = get_object_or_404(SalesOrder, pk=pk)
        if order.status != SalesOrder.Status.PROCESSING:
            return Response({'detail': 'Order must be Processing before shipping.'},
                            status=status.HTTP_400_BAD_REQUEST)
        order.status     = SalesOrder.Status.SHIPPED
        order.shipped_at = timezone.now()
        order.save()
        return Response({'detail': f'{order.order_number} shipped.', 'status': order.status})


class DeliverSalesOrderView(APIView):
    """POST /api/orders/sales/<id>/deliver/"""
    def post(self, request, pk):
        order = get_object_or_404(SalesOrder, pk=pk)
        if order.status not in (SalesOrder.Status.SHIPPED, SalesOrder.Status.PROCESSING):
            return Response({'detail': 'Order must be Shipped or Processing before delivery.'},
                            status=status.HTTP_400_BAD_REQUEST)
        order.status       = SalesOrder.Status.DELIVERED
        order.delivered_at = timezone.now()
        # Mark all lines as fully delivered
        order.lines.all().update(quantity_delivered=models.F('quantity'))
        order.save()
        return Response({'detail': f'{order.order_number} delivered.', 'status': order.status})


class CancelSalesOrderView(APIView):
    """POST /api/orders/sales/<id>/cancel/"""
    def post(self, request, pk):
        order  = get_object_or_404(SalesOrder, pk=pk)
        reason = request.data.get('reason', '').strip()
        if order.status in (SalesOrder.Status.DELIVERED, SalesOrder.Status.CANCELLED):
            return Response({'detail': f'Cannot cancel a {order.status} order.'},
                            status=status.HTTP_400_BAD_REQUEST)
        order.status           = SalesOrder.Status.CANCELLED
        order.rejection_reason = reason
        order.save()
        return Response({'detail': f'{order.order_number} cancelled.', 'status': order.status})


# ── Purchase Orders ───────────────────────────────────────────

class PurchaseOrderListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return PurchaseOrderSerializer if self.request.method == 'POST' else PurchaseOrderListSerializer

    def get_queryset(self):
        qs = PurchaseOrder.objects.select_related('warehouse').all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if v := self.request.query_params.get('supplier'):
            qs = qs.filter(supplier__icontains=v)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=get_user(self.request))


class PurchaseOrderDetailView(generics.RetrieveAPIView):
    serializer_class = PurchaseOrderSerializer
    queryset         = PurchaseOrder.objects.prefetch_related('lines__product').all()


class SubmitPurchaseOrderView(APIView):
    """POST /api/orders/purchases/<id>/submit/"""
    def post(self, request, pk):
        po = get_object_or_404(PurchaseOrder, pk=pk)
        if po.status != PurchaseOrder.Status.DRAFT:
            return Response({'detail': 'Only Draft POs can be submitted.'},
                            status=status.HTTP_400_BAD_REQUEST)
        po.status = PurchaseOrder.Status.SUBMITTED
        po.save()
        return Response({'detail': f'{po.order_number} submitted for approval.', 'status': po.status})


class ApprovePurchaseOrderView(APIView):
    """POST /api/orders/purchases/<id>/approve/"""
    def post(self, request, pk):
        po = get_object_or_404(PurchaseOrder, pk=pk)
        if po.status != PurchaseOrder.Status.SUBMITTED:
            return Response({'detail': 'PO must be Submitted before approval.'},
                            status=status.HTTP_400_BAD_REQUEST)
        po.status      = PurchaseOrder.Status.APPROVED
        po.approved_by = get_user(request)
        po.approved_at = timezone.now()
        po.save()
        return Response({'detail': f'{po.order_number} approved.', 'status': po.status})


class SendPurchaseOrderView(APIView):
    """POST /api/orders/purchases/<id>/send/"""
    def post(self, request, pk):
        po = get_object_or_404(PurchaseOrder, pk=pk)
        if po.status != PurchaseOrder.Status.APPROVED:
            return Response({'detail': 'PO must be Approved before sending.'},
                            status=status.HTTP_400_BAD_REQUEST)
        po.status  = PurchaseOrder.Status.SENT
        po.sent_at = timezone.now()
        po.save()
        return Response({'detail': f'{po.order_number} sent to {po.supplier}.', 'status': po.status})


class ReceivePurchaseOrderView(APIView):
    """POST /api/orders/purchases/<id>/receive/"""
    def post(self, request, pk):
        po = get_object_or_404(PurchaseOrder, pk=pk)
        if po.status not in (PurchaseOrder.Status.SENT, PurchaseOrder.Status.PARTIAL):
            return Response({'detail': 'PO must be Sent before receiving.'},
                            status=status.HTTP_400_BAD_REQUEST)
        for line in po.lines.all():
            line.quantity_received = line.quantity
            line.save()
        po.status        = PurchaseOrder.Status.RECEIVED
        po.received_date = timezone.now().date()
        po.save()
        return Response({'detail': f'{po.order_number} fully received.', 'status': po.status})


class CancelPurchaseOrderView(APIView):
    """POST /api/orders/purchases/<id>/cancel/"""
    def post(self, request, pk):
        po     = get_object_or_404(PurchaseOrder, pk=pk)
        reason = request.data.get('reason', '').strip()
        if po.status in (PurchaseOrder.Status.RECEIVED, PurchaseOrder.Status.CANCELLED):
            return Response({'detail': f'Cannot cancel a {po.status} PO.'},
                            status=status.HTTP_400_BAD_REQUEST)
        po.status           = PurchaseOrder.Status.CANCELLED
        po.rejection_reason = reason
        po.save()
        return Response({'detail': f'{po.order_number} cancelled.', 'status': po.status})


# ── Deliveries ────────────────────────────────────────────────

class DeliveryListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return DeliverySerializer if self.request.method == 'POST' else DeliveryListSerializer

    def get_queryset(self):
        qs = Delivery.objects.select_related('sales_order').all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if o := self.request.query_params.get('sales_order'):
            qs = qs.filter(sales_order_id=o)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=get_user(self.request))


class DeliveryDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = DeliverySerializer
    queryset         = Delivery.objects.prefetch_related('lines').all()


class DispatchDeliveryView(APIView):
    """POST /api/orders/deliveries/<id>/dispatch/"""
    def post(self, request, pk):
        delivery = get_object_or_404(Delivery, pk=pk)
        if delivery.status != Delivery.Status.PENDING:
            return Response({'detail': 'Only Pending deliveries can be dispatched.'},
                            status=status.HTTP_400_BAD_REQUEST)
        delivery.status        = Delivery.Status.DISPATCHED
        delivery.dispatched_at = timezone.now()
        # Update sales order to Shipped
        delivery.sales_order.status     = SalesOrder.Status.SHIPPED
        delivery.sales_order.shipped_at = timezone.now()
        delivery.sales_order.save()
        delivery.save()
        return Response({
            'detail': f'{delivery.delivery_number} dispatched.',
            'status': delivery.status,
        })


class CompleteDeliveryView(APIView):
    """POST /api/orders/deliveries/<id>/complete/"""
    def post(self, request, pk):
        delivery = get_object_or_404(Delivery, pk=pk)
        if delivery.status not in (Delivery.Status.DISPATCHED, Delivery.Status.IN_TRANSIT):
            return Response({'detail': 'Delivery must be Dispatched or In Transit to complete.'},
                            status=status.HTTP_400_BAD_REQUEST)
        delivery.status       = Delivery.Status.DELIVERED
        delivery.delivered_at = timezone.now()
        # Update sales order
        delivery.sales_order.status       = SalesOrder.Status.DELIVERED
        delivery.sales_order.delivered_at = timezone.now()
        delivery.sales_order.save()
        delivery.save()
        return Response({
            'detail': f'{delivery.delivery_number} completed — order delivered.',
            'status': delivery.status,
        })


# ── Dashboard ─────────────────────────────────────────────────

class OrdersDashboardView(APIView):
    """GET /api/orders/dashboard/"""
    def get(self, request):
        today = timezone.now().date()

        so = SalesOrder.objects.all()
        po = PurchaseOrder.objects.all()
        qt = Quotation.objects.all()

        active_so  = so.filter(status__in=['Pending', 'Confirmed', 'Approved', 'Processing', 'Shipped'])
        overdue_so = [o for o in active_so if o.requested_date and o.requested_date < today]

        return Response({
            # Sales
            'total_sales_orders':   so.count(),
            'active_sales_orders':  active_so.count(),
            'overdue_sales_orders': len(overdue_so),
            'delivered_mtd':        so.filter(
                status='Delivered',
                delivered_at__year=today.year,
                delivered_at__month=today.month,
            ).count(),
            'sales_value_mtd': sum(
                o.total_amount for o in so.filter(
                    order_date__year=today.year,
                    order_date__month=today.month,
                )
            ),
            # Purchase
            'total_purchase_orders':  po.count(),
            'pending_purchase_orders':po.filter(status__in=['Draft', 'Submitted', 'Approved', 'Sent']).count(),
            'purchase_value_mtd': sum(
                o.total_amount for o in po.filter(
                    order_date__year=today.year,
                    order_date__month=today.month,
                )
            ),
            # Quotations
            'total_quotations':    qt.count(),
            'pending_quotations':  qt.filter(status__in=['Draft', 'Sent']).count(),
            'accepted_quotations': qt.filter(status='Accepted').count(),
            # Deliveries
            'pending_deliveries':  Delivery.objects.filter(
                status__in=['Pending', 'Dispatched', 'In_Transit']
            ).count(),
        })