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
    Category, Warehouse, Product, WarehouseInventory,
    StockMovement, PurchaseOrder, PurchaseOrderLine,
    StockAdjustment, FIFOLayer,
)
from .serializers import (
    CategorySerializer, WarehouseSerializer,
    ProductSerializer, ProductListSerializer,
    StockMovementSerializer,
    PurchaseOrderSerializer, PurchaseOrderListSerializer,
    StockAdjustmentSerializer,
)


def get_user(request):
    return request.user if request.user.is_authenticated else None


def get_gl_account(name_contains):
    try:
        from apps.Finance.models import Account
        return Account.objects.filter(name__icontains=name_contains, is_active=True).first()
    except Exception:
        return None


def post_stock_gl(entry_data, lines_data, user):
    """Helper to post GL journal entry for stock movements."""
    try:
        from apps.Finance.models import JournalEntry, JournalLine
        entry = JournalEntry.objects.create(**entry_data, created_by=user)
        JournalLine.objects.bulk_create([
            JournalLine(entry=entry, **ld) for ld in lines_data
        ])
        entry.post()
        return entry
    except Exception:
        return None


def get_or_create_inventory(product, warehouse):
    inv, _ = WarehouseInventory.objects.get_or_create(
        product=product, warehouse=warehouse,
        defaults={'quantity_on_hand': 0, 'quantity_reserved': 0},
    )
    return inv


def update_wac(product, new_qty, new_cost):
    """Recalculate weighted average cost after a receipt."""
    current_stock = product.total_stock
    current_cost  = product.cost_price
    if current_stock + new_qty > 0:
        wac = (current_stock * current_cost + new_qty * new_cost) / (current_stock + new_qty)
        product.cost_price = wac.quantize(Decimal('0.01'))
        product.save()


def consume_fifo(product, warehouse, quantity):
    """Consume stock using FIFO layers. Returns average cost of consumed units."""
    layers = FIFOLayer.objects.filter(
        product=product, warehouse=warehouse, quantity_remaining__gt=0
    ).order_by('receipt_date', 'created_at')

    remaining  = Decimal(str(quantity))
    total_cost = Decimal('0')

    for layer in layers:
        if remaining <= 0:
            break
        consume = min(layer.quantity_remaining, remaining)
        total_cost += consume * layer.unit_cost
        layer.quantity_remaining -= consume
        layer.save()
        remaining -= consume

    avg_cost = (total_cost / Decimal(str(quantity))).quantize(Decimal('0.01')) if quantity > 0 else Decimal('0')
    return avg_cost


# ── Categories ────────────────────────────────────────────────

class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    queryset         = Category.objects.all()


class CategoryDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CategorySerializer
    queryset         = Category.objects.all()


# ── Warehouses ────────────────────────────────────────────────

class WarehouseListCreateView(generics.ListCreateAPIView):
    serializer_class = WarehouseSerializer
    queryset         = Warehouse.objects.all()


class WarehouseDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = WarehouseSerializer
    queryset         = Warehouse.objects.all()


# ── Products ──────────────────────────────────────────────────

class ProductListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return ProductSerializer if self.request.method == 'POST' else ProductListSerializer

    def get_queryset(self):
        qs = Product.objects.select_related('category').prefetch_related('inventory').all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if t := self.request.query_params.get('product_type'):
            qs = qs.filter(product_type=t)
        if c := self.request.query_params.get('category'):
            qs = qs.filter(category_id=c)
        if self.request.query_params.get('low_stock') == 'true':
            all_products = list(qs)
            return [p for p in all_products if p.is_below_reorder_point]
        if self.request.query_params.get('out_of_stock') == 'true':
            all_products = list(qs)
            return [p for p in all_products if p.is_out_of_stock]
        if q := self.request.query_params.get('search'):
            qs = qs.filter(name__icontains=q) | qs.filter(sku__icontains=q) | qs.filter(barcode__icontains=q)
        return qs


class ProductDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ProductSerializer
    queryset         = Product.objects.prefetch_related('inventory__warehouse').all()


# ── Stock Movements ───────────────────────────────────────────

class StockMovementListView(generics.ListAPIView):
    serializer_class = StockMovementSerializer

    def get_queryset(self):
        qs = StockMovement.objects.select_related('product', 'warehouse').all()
        if p := self.request.query_params.get('product'):
            qs = qs.filter(product_id=p)
        if w := self.request.query_params.get('warehouse'):
            qs = qs.filter(warehouse_id=w)
        if t := self.request.query_params.get('movement_type'):
            qs = qs.filter(movement_type=t)
        return qs


class ReceiveStockView(APIView):
    """
    POST /api/inventory/products/<id>/receive/

    Receive stock into a warehouse from a purchase.
    Updates stock quantity and WAC/FIFO.
    Auto-posts GL: DR Inventory, CR Accounts Payable.

    Body:
    {
      "warehouse": 1,
      "quantity": 100,
      "unit_cost": 1500,
      "date": "2026-03-19",
      "source_ref": "PO-000001",
      "notes": "Received from supplier"
    }
    """
    @transaction.atomic
    def post(self, request, pk):
        product  = get_object_or_404(Product, pk=pk)
        if product.product_type == Product.ProductType.SERVICE:
            return Response({'detail': 'Cannot receive stock for a service product.'},
                            status=status.HTTP_400_BAD_REQUEST)

        warehouse_id = request.data.get('warehouse')
        quantity     = Decimal(str(request.data.get('quantity', 0)))
        unit_cost    = Decimal(str(request.data.get('unit_cost', product.cost_price)))
        date         = request.data.get('date', timezone.now().date().isoformat())
        source_ref   = request.data.get('source_ref', '')
        notes        = request.data.get('notes', '')

        if quantity <= 0:
            return Response({'detail': 'Quantity must be positive.'}, status=status.HTTP_400_BAD_REQUEST)

        warehouse = get_object_or_404(Warehouse, pk=warehouse_id)
        inv       = get_or_create_inventory(product, warehouse)
        qty_before = inv.quantity_on_hand

        # Update WAC
        if product.valuation_method == Product.ValuationMethod.WAC:
            update_wac(product, quantity, unit_cost)
        elif product.valuation_method == Product.ValuationMethod.FIFO:
            FIFOLayer.objects.create(
                product=product, warehouse=warehouse,
                receipt_date=date, quantity_in=quantity,
                quantity_remaining=quantity, unit_cost=unit_cost,
                source_ref=source_ref,
            )

        # Update inventory
        inv.quantity_on_hand += quantity
        inv.save()

        # Create movement record
        movement = StockMovement.objects.create(
            product=product, warehouse=warehouse,
            movement_type=StockMovement.MovementType.RECEIPT,
            quantity=quantity, unit_cost=unit_cost,
            quantity_before=qty_before, quantity_after=inv.quantity_on_hand,
            date=date, source_ref=source_ref, notes=notes,
            created_by=get_user(request),
        )

        # Post GL: DR Inventory CR AP
        try:
            from apps.Finance.models import JournalEntry, JournalLine
            inv_account = (product.inventory_account or get_gl_account('Inventory')
                           or get_gl_account('Stock'))
            ap_account  = get_gl_account('Accounts Payable')

            if inv_account and ap_account:
                total = quantity * unit_cost
                entry = JournalEntry.objects.create(
                    date=date,
                    description=f'Stock receipt — {product.name} ({product.sku})',
                    source=JournalEntry.Source.PURCHASE,
                    status=JournalEntry.Status.DRAFT,
                    notes=f'PO: {source_ref}. Qty: {quantity} @ KES {unit_cost}',
                    created_by=get_user(request),
                )
                JournalLine.objects.create(entry=entry, account=inv_account,
                    debit=total, credit=Decimal('0'),
                    description=f'Stock in — {product.sku}')
                JournalLine.objects.create(entry=entry, account=ap_account,
                    debit=Decimal('0'), credit=total,
                    description=f'Supplier payable — {source_ref}')
                entry.post()
                movement.journal_entry = entry
                movement.save()
        except Exception:
            pass

        return Response({
            'detail':          f'Received {quantity} units of {product.name}.',
            'movement':        StockMovementSerializer(movement).data,
            'new_stock':       inv.quantity_on_hand,
            'updated_cost':    product.cost_price,
        })


class IssueStockView(APIView):
    """
    POST /api/inventory/products/<id>/issue/

    Issue stock from a warehouse (for sales, consumption, etc.)
    Auto-posts GL: DR COGS, CR Inventory.

    Body:
    {
      "warehouse": 1,
      "quantity": 10,
      "date": "2026-03-19",
      "source_ref": "INV-000001",
      "notes": "Sold to customer"
    }
    """
    @transaction.atomic
    def post(self, request, pk):
        product = get_object_or_404(Product, pk=pk)
        if product.product_type == Product.ProductType.SERVICE:
            return Response({'detail': 'Cannot issue stock for a service product.'},
                            status=status.HTTP_400_BAD_REQUEST)

        warehouse_id = request.data.get('warehouse')
        quantity     = Decimal(str(request.data.get('quantity', 0)))
        date         = request.data.get('date', timezone.now().date().isoformat())
        source_ref   = request.data.get('source_ref', '')
        notes        = request.data.get('notes', '')

        if quantity <= 0:
            return Response({'detail': 'Quantity must be positive.'}, status=status.HTTP_400_BAD_REQUEST)

        warehouse = get_object_or_404(Warehouse, pk=warehouse_id)
        inv       = get_or_create_inventory(product, warehouse)

        if inv.quantity_on_hand < quantity:
            return Response(
                {'detail': f'Insufficient stock. Available: {inv.quantity_on_hand}, Requested: {quantity}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qty_before = inv.quantity_on_hand

        # Determine unit cost
        if product.valuation_method == Product.ValuationMethod.FIFO:
            unit_cost = consume_fifo(product, warehouse, quantity)
        else:
            unit_cost = product.cost_price

        inv.quantity_on_hand -= quantity
        inv.save()

        movement = StockMovement.objects.create(
            product=product, warehouse=warehouse,
            movement_type=StockMovement.MovementType.ISSUE,
            quantity=quantity, unit_cost=unit_cost,
            quantity_before=qty_before, quantity_after=inv.quantity_on_hand,
            date=date, source_ref=source_ref, notes=notes,
            created_by=get_user(request),
        )

        # Post GL: DR COGS, CR Inventory
        try:
            from apps.Finance.models import JournalEntry, JournalLine
            inv_account  = product.inventory_account or get_gl_account('Inventory') or get_gl_account('Stock')
            cogs_account = product.cogs_account or get_gl_account('Cost of Goods Sold')

            if inv_account and cogs_account:
                total = quantity * unit_cost
                entry = JournalEntry.objects.create(
                    date=date,
                    description=f'Stock issue — {product.name} ({product.sku})',
                    source=JournalEntry.Source.SALES,
                    status=JournalEntry.Status.DRAFT,
                    notes=f'Ref: {source_ref}. Qty: {quantity} @ KES {unit_cost}',
                    created_by=get_user(request),
                )
                JournalLine.objects.create(entry=entry, account=cogs_account,
                    debit=total, credit=Decimal('0'),
                    description=f'COGS — {product.sku}')
                JournalLine.objects.create(entry=entry, account=inv_account,
                    debit=Decimal('0'), credit=total,
                    description=f'Stock out — {product.sku}')
                entry.post()
                movement.journal_entry = entry
                movement.save()
        except Exception:
            pass

        return Response({
            'detail':       f'Issued {quantity} units of {product.name}.',
            'movement':     StockMovementSerializer(movement).data,
            'new_stock':    inv.quantity_on_hand,
            'unit_cost':    unit_cost,
        })


class TransferStockView(APIView):
    """
    POST /api/inventory/products/<id>/transfer/
    Body: {"from_warehouse": 1, "to_warehouse": 2, "quantity": 10, "date": "2026-03-19"}
    """
    @transaction.atomic
    def post(self, request, pk):
        product      = get_object_or_404(Product, pk=pk)
        from_wh_id   = request.data.get('from_warehouse')
        to_wh_id     = request.data.get('to_warehouse')
        quantity     = Decimal(str(request.data.get('quantity', 0)))
        date         = request.data.get('date', timezone.now().date().isoformat())
        notes        = request.data.get('notes', '')

        if from_wh_id == to_wh_id:
            return Response({'detail': 'Source and destination warehouses must differ.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if quantity <= 0:
            return Response({'detail': 'Quantity must be positive.'}, status=status.HTTP_400_BAD_REQUEST)

        from_wh  = get_object_or_404(Warehouse, pk=from_wh_id)
        to_wh    = get_object_or_404(Warehouse, pk=to_wh_id)
        from_inv = get_or_create_inventory(product, from_wh)
        to_inv   = get_or_create_inventory(product, to_wh)

        if from_inv.quantity_on_hand < quantity:
            return Response({'detail': f'Insufficient stock in {from_wh.name}. Available: {from_inv.quantity_on_hand}'},
                            status=status.HTTP_400_BAD_REQUEST)

        unit_cost  = product.cost_price
        from_inv.quantity_on_hand -= quantity
        from_inv.save()
        to_inv.quantity_on_hand += quantity
        to_inv.save()

        movement = StockMovement.objects.create(
            product=product, warehouse=from_wh, to_warehouse=to_wh,
            movement_type=StockMovement.MovementType.TRANSFER,
            quantity=quantity, unit_cost=unit_cost,
            quantity_before=from_inv.quantity_on_hand + quantity,
            quantity_after=from_inv.quantity_on_hand,
            date=date, notes=notes,
            created_by=get_user(request),
        )

        return Response({
            'detail':      f'Transferred {quantity} units from {from_wh.name} to {to_wh.name}.',
            'movement':    StockMovementSerializer(movement).data,
        })


# ── Purchase Orders ───────────────────────────────────────────

class PurchaseOrderListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return PurchaseOrderSerializer if self.request.method == 'POST' else PurchaseOrderListSerializer

    def get_queryset(self):
        qs = PurchaseOrder.objects.select_related('warehouse').all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=get_user(self.request))


class PurchaseOrderDetailView(generics.RetrieveAPIView):
    serializer_class = PurchaseOrderSerializer
    queryset         = PurchaseOrder.objects.prefetch_related('lines__product').all()


class ApprovePOView(APIView):
    """POST /api/inventory/pos/<id>/approve/"""
    def post(self, request, pk):
        po = get_object_or_404(PurchaseOrder, pk=pk)
        if po.status != PurchaseOrder.Status.DRAFT:
            return Response({'detail': 'Only Draft POs can be approved.'},
                            status=status.HTTP_400_BAD_REQUEST)
        po.status      = PurchaseOrder.Status.APPROVED
        po.approved_by = get_user(request)
        po.approved_at = timezone.now()
        po.save()
        return Response({'detail': f'{po.po_number} approved.', 'status': po.status})


class ReceivePOView(APIView):
    """
    POST /api/inventory/pos/<id>/receive/

    Receive all lines of an approved PO into the warehouse.
    Creates stock movements and updates inventory.
    Posts GL for each product received.
    """
    @transaction.atomic
    def post(self, request, pk):
        po = get_object_or_404(PurchaseOrder, pk=pk)
        if po.status not in (PurchaseOrder.Status.APPROVED, PurchaseOrder.Status.PARTIAL):
            return Response({'detail': 'PO must be Approved before receiving.'},
                            status=status.HTTP_400_BAD_REQUEST)

        date     = request.data.get('date', timezone.now().date().isoformat())
        received = []
        all_received = True

        for line in po.lines.all():
            if line.is_fully_received:
                continue

            qty = line.quantity_pending
            product  = line.product
            inv      = get_or_create_inventory(product, po.warehouse)
            qty_before = inv.quantity_on_hand

            # Valuation update
            if product.valuation_method == Product.ValuationMethod.WAC:
                update_wac(product, qty, line.unit_cost)
            elif product.valuation_method == Product.ValuationMethod.FIFO:
                FIFOLayer.objects.create(
                    product=product, warehouse=po.warehouse,
                    receipt_date=date, quantity_in=qty,
                    quantity_remaining=qty, unit_cost=line.unit_cost,
                    source_ref=po.po_number,
                )

            inv.quantity_on_hand += qty
            inv.save()
            line.quantity_received += qty
            line.save()

            movement = StockMovement.objects.create(
                product=product, warehouse=po.warehouse,
                movement_type=StockMovement.MovementType.RECEIPT,
                quantity=qty, unit_cost=line.unit_cost,
                quantity_before=qty_before,
                quantity_after=inv.quantity_on_hand,
                date=date, source_ref=po.po_number,
                notes=f'Received via {po.po_number}',
                created_by=get_user(request),
            )
            received.append({'product': product.sku, 'qty': qty})

        # Update PO status
        fully_done = all(l.is_fully_received for l in po.lines.all())
        po.status  = PurchaseOrder.Status.RECEIVED if fully_done else PurchaseOrder.Status.PARTIAL
        po.save()

        return Response({
            'detail':   f'{po.po_number} {"fully" if fully_done else "partially"} received.',
            'received': received,
            'status':   po.status,
        })


class CancelPOView(APIView):
    """POST /api/inventory/pos/<id>/cancel/"""
    def post(self, request, pk):
        po = get_object_or_404(PurchaseOrder, pk=pk)
        if po.status in (PurchaseOrder.Status.RECEIVED, PurchaseOrder.Status.CANCELLED):
            return Response({'detail': f'Cannot cancel a {po.status} PO.'},
                            status=status.HTTP_400_BAD_REQUEST)
        po.status = PurchaseOrder.Status.CANCELLED
        po.save()
        return Response({'detail': f'{po.po_number} cancelled.', 'status': po.status})


# ── Stock Adjustments ─────────────────────────────────────────

class StockAdjustmentView(APIView):
    """
    POST /api/inventory/products/<id>/adjust/

    Adjust stock for damage, expiry, theft, count variance.
    Posts GL: DR Loss/Expense, CR Inventory (if negative adj).

    Body:
    {
      "warehouse": 1,
      "new_quantity": 85,
      "reason": "Damage",
      "date": "2026-03-19",
      "notes": "Water damaged during storage"
    }
    """
    @transaction.atomic
    def post(self, request, pk):
        product     = get_object_or_404(Product, pk=pk)
        warehouse_id= request.data.get('warehouse')
        new_qty     = Decimal(str(request.data.get('new_quantity', 0)))
        reason      = request.data.get('reason', 'Other')
        date        = request.data.get('date', timezone.now().date().isoformat())
        notes       = request.data.get('notes', '')

        if new_qty < 0:
            return Response({'detail': 'New quantity cannot be negative.'},
                            status=status.HTTP_400_BAD_REQUEST)

        warehouse  = get_object_or_404(Warehouse, pk=warehouse_id)
        inv        = get_or_create_inventory(product, warehouse)
        qty_before = inv.quantity_on_hand
        unit_cost  = product.cost_price
        adj_qty    = new_qty - qty_before

        adj = StockAdjustment.objects.create(
            product=product, warehouse=warehouse,
            reason=reason,
            quantity_before=qty_before, quantity_after=new_qty,
            adjustment_qty=adj_qty,
            unit_cost=unit_cost,
            total_cost=abs(adj_qty * unit_cost),
            date=date, notes=notes,
            created_by=get_user(request),
        )

        inv.quantity_on_hand = new_qty
        inv.save()

        # Also create stock movement
        move_type = StockMovement.MovementType.WRITE_OFF if adj_qty < 0 else StockMovement.MovementType.ADJUSTMENT
        StockMovement.objects.create(
            product=product, warehouse=warehouse,
            movement_type=move_type,
            quantity=abs(adj_qty), unit_cost=unit_cost,
            quantity_before=qty_before, quantity_after=new_qty,
            date=date, notes=f'{reason}: {notes}',
            created_by=get_user(request),
        )

        # Post GL for write-off (negative adjustment)
        journal_entry = None
        if adj_qty < 0:
            try:
                from apps.Finance.models import JournalEntry, JournalLine
                inv_account  = product.inventory_account or get_gl_account('Inventory') or get_gl_account('Stock')
                loss_account = get_gl_account('Loss') or get_gl_account('Expense') or get_gl_account('Office Supplies')
                total        = abs(adj_qty * unit_cost)
                if inv_account and loss_account:
                    entry = JournalEntry.objects.create(
                        date=date,
                        description=f'Stock adjustment — {product.name} ({reason})',
                        source=JournalEntry.Source.MANUAL,
                        status=JournalEntry.Status.DRAFT,
                        notes=notes,
                        created_by=get_user(request),
                    )
                    JournalLine.objects.create(entry=entry, account=loss_account,
                        debit=total, credit=Decimal('0'),
                        description=f'{reason} — {product.sku}')
                    JournalLine.objects.create(entry=entry, account=inv_account,
                        debit=Decimal('0'), credit=total,
                        description=f'Stock write-down — {product.sku}')
                    entry.post()
                    adj.journal_entry = entry
                    adj.save()
                    journal_entry = entry
            except Exception:
                pass

        return Response({
            'detail':       f'Stock adjusted from {qty_before} to {new_qty} ({adj_qty:+.2f}).',
            'adjustment':   StockAdjustmentSerializer(adj).data,
            'journal_entry_id': journal_entry.id if journal_entry else None,
        })


class StockAdjustmentListView(generics.ListAPIView):
    serializer_class = StockAdjustmentSerializer

    def get_queryset(self):
        qs = StockAdjustment.objects.select_related('product', 'warehouse').all()
        if p := self.request.query_params.get('product'):
            qs = qs.filter(product_id=p)
        return qs


# ── Dashboard & Valuation ─────────────────────────────────────

class InventoryDashboardView(APIView):
    """GET /api/inventory/dashboard/"""
    def get(self, request):
        products   = Product.objects.prefetch_related('inventory').all()
        goods      = products.filter(product_type='Goods', track_stock=True)
        services   = products.filter(product_type='Service')

        low_stock  = [p for p in goods if p.is_below_reorder_point]
        out_stock  = [p for p in goods if p.is_out_of_stock]
        total_val  = sum(p.total_stock_value for p in goods)

        pending_pos = PurchaseOrder.objects.filter(
            status__in=[PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.APPROVED]
        ).count()

        movements_today = StockMovement.objects.filter(
            date=timezone.now().date()
        ).count()

        adjustments_mtd = StockAdjustment.objects.filter(
            date__year=timezone.now().year,
            date__month=timezone.now().month,
        ).count()

        return Response({
            'total_products':   products.count(),
            'goods_count':      goods.count(),
            'services_count':   services.count(),
            'total_inventory_value': total_val,
            'low_stock_count':  len(low_stock),
            'out_of_stock_count': len(out_stock),
            'pending_pos':      pending_pos,
            'movements_today':  movements_today,
            'adjustments_mtd':  adjustments_mtd,
            'warehouses':       Warehouse.objects.filter(status='Active').count(),
            'low_stock_products': [
                {'sku': p.sku, 'name': p.name, 'stock': p.total_stock, 'reorder_point': p.reorder_point}
                for p in low_stock[:10]
            ],
            'out_of_stock_products': [
                {'sku': p.sku, 'name': p.name}
                for p in out_stock[:10]
            ],
        })


class ValuationReportView(APIView):
    """
    GET /api/inventory/valuation/

    Stock valuation report by product showing WAC and FIFO values.
    """
    def get(self, request):
        products = Product.objects.filter(
            product_type='Goods', track_stock=True
        ).prefetch_related('inventory', 'fifo_layers').select_related('category')

        report = []
        total_wac_value  = Decimal('0')
        total_fifo_value = Decimal('0')

        for product in products:
            stock = product.total_stock
            if stock <= 0:
                continue

            # WAC value
            wac_value = stock * product.cost_price

            # FIFO value (sum of remaining layers)
            fifo_value = sum(
                layer.quantity_remaining * layer.unit_cost
                for layer in product.fifo_layers.filter(quantity_remaining__gt=0)
            )

            total_wac_value  += wac_value
            total_fifo_value += fifo_value if fifo_value > 0 else wac_value

            report.append({
                'sku':             product.sku,
                'name':            product.name,
                'category':        product.category.name,
                'valuation_method':product.valuation_method,
                'unit_of_measure': product.unit_of_measure,
                'quantity':        stock,
                'wac_unit_cost':   product.cost_price,
                'wac_total':       wac_value,
                'fifo_total':      fifo_value if fifo_value > 0 else wac_value,
            })

        return Response({
            'as_of_date':       timezone.now().date(),
            'total_wac_value':  total_wac_value,
            'total_fifo_value': total_fifo_value,
            'products':         report,
        })


class ReorderAlertsView(APIView):
    """GET /api/inventory/reorder-alerts/"""
    def get(self, request):
        goods = Product.objects.filter(
            product_type='Goods', track_stock=True, status='Active'
        ).prefetch_related('inventory')

        alerts = []
        for p in goods:
            stock = p.total_stock
            if p.is_out_of_stock:
                level = 'critical'
            elif p.is_below_reorder_point:
                level = 'warning'
            else:
                continue

            alerts.append({
                'sku':              p.sku,
                'name':             p.name,
                'current_stock':    stock,
                'reorder_point':    p.reorder_point,
                'reorder_quantity': p.reorder_quantity,
                'preferred_supplier': p.preferred_supplier,
                'lead_time_days':   p.lead_time_days,
                'alert_level':      level,
            })

        alerts.sort(key=lambda x: (x['alert_level'] == 'critical', -float(x['reorder_point'])), reverse=True)

        return Response({
            'total_alerts': len(alerts),
            'critical':     len([a for a in alerts if a['alert_level'] == 'critical']),
            'warning':      len([a for a in alerts if a['alert_level'] == 'warning']),
            'alerts':       alerts,
        })