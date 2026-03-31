from django.shortcuts import render

# Create your views here.
import csv
import io
from datetime import date, timedelta
from decimal import Decimal

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response


def parse_date(val, default):
    try:
        return date.fromisoformat(val)
    except Exception:
        return default


# ── Executive Summary ─────────────────────────────────────────

class ExecutiveSummaryView(APIView):
    """GET /api/reporting/executive-summary/"""
    def get(self, request):
        today = timezone.now().date()
        data  = {}

        # Finance
        try:
            from apps.Finance.models import Account, JournalEntry
            accounts    = Account.objects.filter(is_active=True)
            revenue     = sum(abs(a.balance) for a in accounts.filter(account_type='Revenue'))
            expenses    = sum(abs(a.balance) for a in accounts.filter(account_type='Expense'))
            total_assets= sum(abs(a.balance) for a in accounts.filter(account_type='Asset'))
            total_liab  = sum(abs(a.balance) for a in accounts.filter(account_type='Liability'))
            data['finance'] = {
                'revenue':      float(revenue),
                'expenses':     float(expenses),
                'net_income':   float(revenue - expenses),
                'total_assets': float(total_assets),
                'total_liabilities': float(total_liab),
                'equity':       float(total_assets - total_liab),
            }
        except Exception:
            data['finance'] = {}

        # AR
        try:
            from apps.AR.models import Invoice, Receipt
            ar_active = Invoice.objects.filter(
                status__in=['Approved','Sent','Partially_Collected'])
            data['ar'] = {
                'total_receivable': float(sum(i.balance_due for i in ar_active)),
                'overdue':          float(sum(i.balance_due for i in ar_active if i.is_overdue)),
                'collected_mtd':    float(sum(r.amount for r in Receipt.objects.filter(
                    receipt_date__year=today.year, receipt_date__month=today.month))),
                'invoice_count':    ar_active.count(),
            }
        except Exception:
            data['ar'] = {}

        # AP
        try:
            from apps.AP.models import Bill, Payment
            ap_active = Bill.objects.filter(
                status__in=['Approved_Finance','Partially_Paid'])
            data['ap'] = {
                'total_payable':    float(sum(b.balance_due for b in ap_active)),
                'overdue':          float(sum(b.balance_due for b in ap_active if b.is_overdue)),
                'paid_mtd':         float(sum(p.amount for p in Payment.objects.filter(
                    payment_date__year=today.year, payment_date__month=today.month))),
                'bill_count':       ap_active.count(),
            }
        except Exception:
            data['ap'] = {}

        # Inventory
        try:
            from apps.Inventory.models import Product, WarehouseInventory
            goods = Product.objects.filter(product_type='Goods', track_stock=True)
            data['inventory'] = {
                'total_products':   goods.count(),
                'total_value':      float(sum(p.total_stock_value for p in goods)),
                'low_stock':        sum(1 for p in goods if p.is_below_reorder_point),
                'out_of_stock':     sum(1 for p in goods if p.is_out_of_stock),
            }
        except Exception:
            data['inventory'] = {}

        # Assets
        try:
            from apps.Assets.models import Asset
            assets = Asset.objects.filter(status='Active')
            data['assets'] = {
                'active_count':   assets.count(),
                'total_cost':     float(sum(a.cost for a in assets)),
                'net_book_value': float(sum(a.book_value for a in assets)),
            }
        except Exception:
            data['assets'] = {}

        # Orders
        try:
            from apps.Orders.models import SalesOrder, PurchaseOrder
            data['orders'] = {
                'active_so':    SalesOrder.objects.filter(
                    status__in=['Pending','Confirmed','Approved','Processing','Shipped']).count(),
                'delivered_mtd':SalesOrder.objects.filter(
                    status='Delivered',
                    delivered_at__year=today.year,
                    delivered_at__month=today.month).count(),
                'pending_po':   PurchaseOrder.objects.filter(
                    status__in=['Draft','Submitted','Approved','Sent']).count(),
            }
        except Exception:
            data['orders'] = {}

        data['generated_at'] = today.isoformat()
        return Response(data)


# ── AR / AP Aging ─────────────────────────────────────────────

class ARAgingReportView(APIView):
    """GET /api/reporting/ar-aging/"""
    def get(self, request):
        today = timezone.now().date()
        fmt   = request.query_params.get('format', 'json')

        try:
            from apps.AR.models import Invoice
            invoices = Invoice.objects.filter(
                status__in=['Approved','Sent','Partially_Collected']
            ).select_related('customer')

            buckets = {'current': [], '1_30': [], '31_60': [], '61_90': [], 'over_90': []}
            totals  = {k: Decimal('0') for k in buckets}

            for inv in invoices:
                days  = (today - inv.due_date).days
                entry = {
                    'invoice_number': inv.invoice_number,
                    'customer':       inv.customer.name,
                    'invoice_date':   str(inv.invoice_date),
                    'due_date':       str(inv.due_date),
                    'balance_due':    float(inv.balance_due),
                    'days_overdue':   max(0, days),
                }
                if days <= 0:
                    buckets['current'].append(entry); totals['current'] += inv.balance_due
                elif days <= 30:
                    buckets['1_30'].append(entry);    totals['1_30']    += inv.balance_due
                elif days <= 60:
                    buckets['31_60'].append(entry);   totals['31_60']   += inv.balance_due
                elif days <= 90:
                    buckets['61_90'].append(entry);   totals['61_90']   += inv.balance_due
                else:
                    buckets['over_90'].append(entry); totals['over_90'] += inv.balance_due

            result = {
                'as_of_date':  str(today),
                'grand_total': float(sum(totals.values())),
                'totals':      {k: float(v) for k, v in totals.items()},
                'buckets':     buckets,
            }

            if fmt == 'csv':
                return self._csv(result)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def _csv(self, data):
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="ar_aging.csv"'
        w = csv.writer(resp)
        w.writerow(['AR Aging Report', f'As of {data["as_of_date"]}'])
        w.writerow(['Bucket', 'Invoice No', 'Customer', 'Invoice Date', 'Due Date', 'Balance Due', 'Days Overdue'])
        labels = {'current': 'Current', '1_30': '1-30 Days', '31_60': '31-60 Days', '61_90': '61-90 Days', 'over_90': '90+ Days'}
        for key, rows in data['buckets'].items():
            for r in rows:
                w.writerow([labels[key], r['invoice_number'], r['customer'], r['invoice_date'], r['due_date'], r['balance_due'], r['days_overdue']])
        w.writerow([])
        w.writerow(['Grand Total', '', '', '', '', data['grand_total'], ''])
        return resp


class APAgingReportView(APIView):
    """GET /api/reporting/ap-aging/"""
    def get(self, request):
        today = timezone.now().date()
        fmt   = request.query_params.get('format', 'json')

        try:
            from apps.AP.models import Bill
            bills = Bill.objects.filter(
                status__in=['Approved_Finance','Partially_Paid']
            ).select_related('vendor')

            buckets = {'current': [], '1_30': [], '31_60': [], '61_90': [], 'over_90': []}
            totals  = {k: Decimal('0') for k in buckets}

            for bill in bills:
                days  = (today - bill.due_date).days
                entry = {
                    'bill_number':  bill.bill_number,
                    'vendor':       bill.vendor.name,
                    'bill_date':    str(bill.bill_date),
                    'due_date':     str(bill.due_date),
                    'balance_due':  float(bill.balance_due),
                    'days_overdue': max(0, days),
                }
                if days <= 0:
                    buckets['current'].append(entry); totals['current'] += bill.balance_due
                elif days <= 30:
                    buckets['1_30'].append(entry);    totals['1_30']    += bill.balance_due
                elif days <= 60:
                    buckets['31_60'].append(entry);   totals['31_60']   += bill.balance_due
                elif days <= 90:
                    buckets['61_90'].append(entry);   totals['61_90']   += bill.balance_due
                else:
                    buckets['over_90'].append(entry); totals['over_90'] += bill.balance_due

            result = {
                'as_of_date':  str(today),
                'grand_total': float(sum(totals.values())),
                'totals':      {k: float(v) for k, v in totals.items()},
                'buckets':     buckets,
            }

            if fmt == 'csv':
                return self._csv(result)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def _csv(self, data):
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="ap_aging.csv"'
        w = csv.writer(resp)
        w.writerow(['AP Aging Report', f'As of {data["as_of_date"]}'])
        w.writerow(['Bucket', 'Bill No', 'Vendor', 'Bill Date', 'Due Date', 'Balance Due', 'Days Overdue'])
        labels = {'current': 'Current', '1_30': '1-30 Days', '31_60': '31-60 Days', '61_90': '61-90 Days', 'over_90': '90+ Days'}
        for key, rows in data['buckets'].items():
            for r in rows:
                w.writerow([labels[key], r['bill_number'], r['vendor'], r['bill_date'], r['due_date'], r['balance_due'], r['days_overdue']])
        w.writerow([])
        w.writerow(['Grand Total', '', '', '', '', data['grand_total'], ''])
        return resp


# ── Inventory Reports ─────────────────────────────────────────

class InventoryValuationReportView(APIView):
    """GET /api/reporting/inventory-valuation/"""
    def get(self, request):
        fmt      = request.query_params.get('format', 'json')
        category = request.query_params.get('category', '')

        try:
            from apps.Inventory.models import Product
            qs = Product.objects.filter(product_type='Goods', track_stock=True).select_related('category')
            if category:
                qs = qs.filter(category__name__icontains=category)

            rows = []
            total_value = Decimal('0')
            for p in qs:
                stock = p.total_stock
                value = stock * p.cost_price
                total_value += value
                rows.append({
                    'sku':              p.sku,
                    'name':             p.name,
                    'category':         p.category.name,
                    'valuation_method': p.valuation_method,
                    'unit_of_measure':  p.unit_of_measure,
                    'quantity':         float(stock),
                    'unit_cost':        float(p.cost_price),
                    'total_value':      float(value),
                    'reorder_point':    float(p.reorder_point),
                    'status':           'OK' if not p.is_below_reorder_point else 'LOW' if not p.is_out_of_stock else 'OUT',
                })

            result = {
                'as_of_date':  str(timezone.now().date()),
                'total_value': float(total_value),
                'product_count': len(rows),
                'rows':        rows,
            }

            if fmt == 'csv':
                return self._csv(result)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def _csv(self, data):
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="inventory_valuation.csv"'
        w = csv.writer(resp)
        w.writerow(['Inventory Valuation Report', f'As of {data["as_of_date"]}'])
        w.writerow(['SKU', 'Product', 'Category', 'Method', 'UoM', 'Quantity', 'Unit Cost', 'Total Value', 'Reorder Point', 'Status'])
        for r in data['rows']:
            w.writerow([r['sku'], r['name'], r['category'], r['valuation_method'], r['unit_of_measure'], r['quantity'], r['unit_cost'], r['total_value'], r['reorder_point'], r['status']])
        w.writerow([])
        w.writerow(['TOTAL', '', '', '', '', '', '', data['total_value'], '', ''])
        return resp


class StockMovementReportView(APIView):
    """GET /api/reporting/stock-movements/?date_from=&date_to=&warehouse="""
    def get(self, request):
        today     = timezone.now().date()
        date_from = parse_date(request.query_params.get('date_from'), today - timedelta(days=30))
        date_to   = parse_date(request.query_params.get('date_to'),   today)
        warehouse = request.query_params.get('warehouse', '')
        fmt       = request.query_params.get('format', 'json')

        try:
            from apps.Inventory.models import StockMovement
            qs = StockMovement.objects.filter(date__gte=date_from, date__lte=date_to).select_related('product', 'warehouse')
            if warehouse:
                qs = qs.filter(warehouse__name__icontains=warehouse)

            rows = [{
                'reference':     m.reference,
                'date':          str(m.date),
                'product_sku':   m.product.sku,
                'product_name':  m.product.name,
                'warehouse':     m.warehouse.name,
                'movement_type': m.movement_type,
                'quantity':      float(m.quantity),
                'unit_cost':     float(m.unit_cost),
                'total_cost':    float(m.total_cost),
                'qty_before':    float(m.quantity_before),
                'qty_after':     float(m.quantity_after),
                'source_ref':    m.source_ref,
            } for m in qs]

            result = {
                'date_from': str(date_from),
                'date_to':   str(date_to),
                'count':     len(rows),
                'total_value': float(sum(r['total_cost'] for r in rows)),
                'rows':      rows,
            }

            if fmt == 'csv':
                return self._csv(result)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def _csv(self, data):
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="stock_movements.csv"'
        w = csv.writer(resp)
        w.writerow(['Stock Movement Report', f'{data["date_from"]} to {data["date_to"]}'])
        w.writerow(['Reference', 'Date', 'SKU', 'Product', 'Warehouse', 'Type', 'Qty', 'Unit Cost', 'Total Cost', 'Qty Before', 'Qty After', 'Source Ref'])
        for r in data['rows']:
            w.writerow([r['reference'], r['date'], r['product_sku'], r['product_name'], r['warehouse'], r['movement_type'], r['quantity'], r['unit_cost'], r['total_cost'], r['qty_before'], r['qty_after'], r['source_ref']])
        return resp


class ReorderAlertReportView(APIView):
    """GET /api/reporting/reorder-alerts/"""
    def get(self, request):
        fmt = request.query_params.get('format', 'json')
        try:
            from apps.Inventory.models import Product
            goods  = Product.objects.filter(product_type='Goods', track_stock=True, status='Active')
            alerts = []
            for p in goods:
                stock = p.total_stock
                if p.is_out_of_stock or p.is_below_reorder_point:
                    alerts.append({
                        'sku':              p.sku,
                        'name':             p.name,
                        'category':         p.category.name,
                        'current_stock':    float(stock),
                        'reorder_point':    float(p.reorder_point),
                        'reorder_quantity': float(p.reorder_quantity),
                        'preferred_supplier': p.preferred_supplier,
                        'lead_time_days':   p.lead_time_days,
                        'alert_level':      'CRITICAL' if p.is_out_of_stock else 'WARNING',
                    })

            result = {'count': len(alerts), 'alerts': alerts}
            if fmt == 'csv':
                return self._csv(result)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def _csv(self, data):
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="reorder_alerts.csv"'
        w = csv.writer(resp)
        w.writerow(['Reorder Alert Report'])
        w.writerow(['Alert', 'SKU', 'Product', 'Category', 'Current Stock', 'Reorder Point', 'Reorder Qty', 'Supplier', 'Lead Time'])
        for r in data['alerts']:
            w.writerow([r['alert_level'], r['sku'], r['name'], r['category'], r['current_stock'], r['reorder_point'], r['reorder_quantity'], r['preferred_supplier'], r['lead_time_days']])
        return resp


# ── Sales Reports ─────────────────────────────────────────────

class SalesReportView(APIView):
    """GET /api/reporting/sales/?date_from=&date_to="""
    def get(self, request):
        today     = timezone.now().date()
        date_from = parse_date(request.query_params.get('date_from'), today.replace(day=1))
        date_to   = parse_date(request.query_params.get('date_to'),   today)
        fmt       = request.query_params.get('format', 'json')

        try:
            from apps.Orders.models import SalesOrder
            orders = SalesOrder.objects.filter(
                order_date__gte=date_from,
                order_date__lte=date_to,
            )

            # By customer
            by_customer = {}
            for o in orders:
                if o.customer not in by_customer:
                    by_customer[o.customer] = {'count': 0, 'total': Decimal('0')}
                by_customer[o.customer]['count'] += 1
                by_customer[o.customer]['total'] += o.total_amount

            # By status
            by_status = {}
            for o in orders:
                by_status[o.status] = by_status.get(o.status, 0) + 1

            # By month
            by_month = {}
            for o in orders:
                key = o.order_date.strftime('%Y-%m')
                if key not in by_month:
                    by_month[key] = {'count': 0, 'total': Decimal('0')}
                by_month[key]['count'] += 1
                by_month[key]['total'] += o.total_amount

            rows = [{
                'order_number':  o.order_number,
                'customer':      o.customer,
                'order_date':    str(o.order_date),
                'status':        o.status,
                'payment_status':o.payment_status,
                'total_amount':  float(o.total_amount),
            } for o in orders]

            result = {
                'date_from':    str(date_from),
                'date_to':      str(date_to),
                'total_orders': orders.count(),
                'total_revenue':float(sum(o.total_amount for o in orders)),
                'by_customer':  [{'customer': k, 'count': v['count'], 'total': float(v['total'])} for k, v in sorted(by_customer.items(), key=lambda x: -x[1]['total'])],
                'by_status':    [{'status': k, 'count': v} for k, v in by_status.items()],
                'by_month':     [{'month': k, 'count': v['count'], 'total': float(v['total'])} for k, v in sorted(by_month.items())],
                'rows':         rows,
            }

            if fmt == 'csv':
                return self._csv(result)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def _csv(self, data):
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="sales_report.csv"'
        w = csv.writer(resp)
        w.writerow(['Sales Report', f'{data["date_from"]} to {data["date_to"]}'])
        w.writerow(['Order No', 'Customer', 'Order Date', 'Status', 'Payment', 'Total Amount'])
        for r in data['rows']:
            w.writerow([r['order_number'], r['customer'], r['order_date'], r['status'], r['payment_status'], r['total_amount']])
        w.writerow([])
        w.writerow(['TOTAL', '', '', '', '', data['total_revenue']])
        return resp


# ── Purchase Reports ──────────────────────────────────────────

class PurchaseReportView(APIView):
    """GET /api/reporting/purchase/?date_from=&date_to="""
    def get(self, request):
        today     = timezone.now().date()
        date_from = parse_date(request.query_params.get('date_from'), today.replace(day=1))
        date_to   = parse_date(request.query_params.get('date_to'),   today)
        fmt       = request.query_params.get('format', 'json')

        try:
            from apps.Purchase.models import GoodsReceivedNote, Supplier
            grns = GoodsReceivedNote.objects.filter(
                received_date__gte=date_from,
                received_date__lte=date_to,
            ).select_related('supplier', 'warehouse')

            by_supplier = {}
            for g in grns:
                name = g.supplier.name
                if name not in by_supplier:
                    by_supplier[name] = {'count': 0, 'total': Decimal('0')}
                by_supplier[name]['count'] += 1
                by_supplier[name]['total'] += g.total_value

            rows = [{
                'grn_number':   g.grn_number,
                'supplier':     g.supplier.name,
                'warehouse':    g.warehouse.name if g.warehouse else '—',
                'received_date':str(g.received_date),
                'po_reference': g.po_reference,
                'status':       g.status,
                'total_items':  g.total_items,
                'total_value':  float(g.total_value),
            } for g in grns]

            result = {
                'date_from':    str(date_from),
                'date_to':      str(date_to),
                'total_grns':   grns.count(),
                'total_value':  float(sum(g.total_value for g in grns)),
                'by_supplier':  [{'supplier': k, 'count': v['count'], 'total': float(v['total'])} for k, v in sorted(by_supplier.items(), key=lambda x: -x[1]['total'])],
                'rows':         rows,
            }

            if fmt == 'csv':
                return self._csv(result)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def _csv(self, data):
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="purchase_report.csv"'
        w = csv.writer(resp)
        w.writerow(['Purchase / GRN Report', f'{data["date_from"]} to {data["date_to"]}'])
        w.writerow(['GRN No', 'Supplier', 'Warehouse', 'Date', 'PO Ref', 'Status', 'Items', 'Total Value'])
        for r in data['rows']:
            w.writerow([r['grn_number'], r['supplier'], r['warehouse'], r['received_date'], r['po_reference'], r['status'], r['total_items'], r['total_value']])
        w.writerow([])
        w.writerow(['TOTAL', '', '', '', '', '', '', data['total_value']])
        return resp


# ── Fixed Assets Reports ──────────────────────────────────────

class AssetRegisterReportView(APIView):
    """GET /api/reporting/asset-register/"""
    def get(self, request):
        fmt      = request.query_params.get('format', 'json')
        category = request.query_params.get('category', '')

        try:
            from apps.Assets.models import Asset
            qs = Asset.objects.select_related('category').all()
            if category:
                qs = qs.filter(category__name__icontains=category)

            rows = [{
                'asset_number':           a.asset_number,
                'name':                   a.name,
                'category':               a.category.name,
                'depreciation_method':    a.depreciation_method,
                'status':                 a.status,
                'cost':                   float(a.cost),
                'accumulated_depreciation': float(a.accumulated_depreciation),
                'book_value':             float(a.book_value),
                'salvage_value':          float(a.salvage_value),
                'useful_life_months':     a.useful_life_months,
                'remaining_life_months':  a.remaining_life_months,
                'in_service_date':        str(a.in_service_date) if a.in_service_date else '',
                'location':               a.location,
                'supplier':               a.supplier,
                'depreciation_pct':       float(a.depreciation_percentage),
            } for a in qs]

            total_cost  = sum(r['cost'] for r in rows)
            total_accum = sum(r['accumulated_depreciation'] for r in rows)
            total_nbv   = sum(r['book_value'] for r in rows)

            result = {
                'as_of_date':  str(timezone.now().date()),
                'asset_count': len(rows),
                'total_cost':  total_cost,
                'total_accumulated': total_accum,
                'total_nbv':   total_nbv,
                'rows':        rows,
            }

            if fmt == 'csv':
                return self._csv(result)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def _csv(self, data):
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="asset_register.csv"'
        w = csv.writer(resp)
        w.writerow(['Fixed Asset Register', f'As of {data["as_of_date"]}'])
        w.writerow(['Asset No', 'Name', 'Category', 'Method', 'Status', 'Cost', 'Accum. Depr', 'Book Value', 'Salvage', 'Useful Life', 'Remaining', 'In Service Date', 'Location', 'Depr %'])
        for r in data['rows']:
            w.writerow([r['asset_number'], r['name'], r['category'], r['depreciation_method'], r['status'], r['cost'], r['accumulated_depreciation'], r['book_value'], r['salvage_value'], r['useful_life_months'], r['remaining_life_months'], r['in_service_date'], r['location'], r['depreciation_pct']])
        w.writerow([])
        w.writerow(['TOTAL', '', '', '', '', data['total_cost'], data['total_accumulated'], data['total_nbv'], '', '', '', '', '', ''])
        return resp


class DepreciationScheduleReportView(APIView):
    """GET /api/reporting/depreciation-schedule/?category="""
    def get(self, request):
        fmt      = request.query_params.get('format', 'json')
        category = request.query_params.get('category', '')

        try:
            from apps.Assets.models import Asset
            from apps.Assets.depreciation import generate_schedule

            qs = Asset.objects.filter(status='Active').select_related('category')
            if category:
                qs = qs.filter(category__name__icontains=category)

            assets_data = []
            for a in qs:
                try:
                    schedule = generate_schedule(a)[:12]
                except Exception:
                    schedule = []
                assets_data.append({
                    'asset_number': a.asset_number,
                    'name':         a.name,
                    'category':     a.category.name,
                    'method':       a.depreciation_method,
                    'book_value':   float(a.book_value),
                    'schedule':     schedule,
                })

            result = {'assets': assets_data, 'as_of_date': str(timezone.now().date())}

            if fmt == 'csv':
                return self._csv(result)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def _csv(self, data):
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="depreciation_schedule.csv"'
        w = csv.writer(resp)
        w.writerow(['Depreciation Schedule', f'As of {data["as_of_date"]}'])
        w.writerow(['Asset No', 'Name', 'Category', 'Method', 'Current Book Value'])
        for a in data['assets']:
            w.writerow([a['asset_number'], a['name'], a['category'], a['method'], a['book_value']])
        return resp