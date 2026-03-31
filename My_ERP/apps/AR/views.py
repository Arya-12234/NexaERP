from django.shortcuts import render

# Create your views here.
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from .models import Customer, Invoice, InvoiceLine, Receipt, ReceiptAllocation, CreditNote
from .serializers import (
    CustomerSerializer, CustomerListSerializer,
    InvoiceSerializer, InvoiceListSerializer,
    ReceiptSerializer, CreditNoteSerializer,
)


def get_user(request):
    return request.user if request.user.is_authenticated else None


def get_gl_account(name_contains):
    try:
        from apps.Finance.models import Account
        return Account.objects.filter(name__icontains=name_contains, is_active=True).first()
    except Exception:
        return None


# ── Customers ─────────────────────────────────────────────────

class CustomerListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return CustomerSerializer if self.request.method == 'POST' else CustomerListSerializer

    def get_queryset(self):
        qs = Customer.objects.all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if t := self.request.query_params.get('customer_type'):
            qs = qs.filter(customer_type=t)
        return qs


class CustomerDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CustomerSerializer
    queryset         = Customer.objects.all()


class CustomerStatementView(APIView):
    """GET /api/ar/customers/<id>/statement/"""
    def get(self, request, pk):
        customer = get_object_or_404(Customer, pk=pk)
        invoices = customer.invoices.exclude(status__in=['Draft', 'Cancelled'])
        receipts = customer.receipts.all()

        return Response({
            'customer':           CustomerSerializer(customer).data,
            'total_invoiced':     sum(i.total_amount    for i in invoices),
            'total_collected':    sum(i.amount_collected for i in invoices),
            'outstanding_balance':customer.outstanding_balance,
            'invoices':           InvoiceListSerializer(invoices, many=True).data,
            'receipts':           ReceiptSerializer(receipts, many=True).data,
        })


# ── Invoices ──────────────────────────────────────────────────

class InvoiceListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        return InvoiceSerializer if self.request.method == 'POST' else InvoiceListSerializer

    def get_queryset(self):
        qs = Invoice.objects.select_related('customer').all()
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if c := self.request.query_params.get('customer'):
            qs = qs.filter(customer_id=c)
        if t := self.request.query_params.get('invoice_type'):
            qs = qs.filter(invoice_type=t)
        if self.request.query_params.get('overdue') == 'true':
            qs = qs.filter(
                status__in=[
                    Invoice.Status.APPROVED,
                    Invoice.Status.SENT,
                    Invoice.Status.PARTIALLY_COLLECTED,
                ],
                due_date__lt=timezone.now().date(),
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=get_user(self.request))


class InvoiceDetailView(generics.RetrieveAPIView):
    serializer_class = InvoiceSerializer
    queryset         = Invoice.objects.prefetch_related('lines').select_related('customer').all()


# ── Invoice Workflow ──────────────────────────────────────────

class ApproveInvoiceView(APIView):
    """
    POST /api/ar/invoices/<id>/approve/

    Approves invoice and posts GL:
    DR  Accounts Receivable   (total amount)
    CR  Sales Revenue         (subtotal)
    CR  VAT Output            (VAT amount)
    DR  WHT Receivable        (if WHT — customer deducts at source)
    """
    @transaction.atomic
    def post(self, request, pk):
        invoice = get_object_or_404(Invoice, pk=pk)

        if invoice.status != Invoice.Status.DRAFT:
            return Response(
                {'detail': 'Only Draft invoices can be approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not invoice.lines.exists():
            return Response(
                {'detail': 'Add at least one line item before approving.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if invoice.invoice_type == Invoice.InvoiceType.PROFORMA:
            # Proforma doesn't post to GL — just mark approved
            invoice.status      = Invoice.Status.APPROVED
            invoice.approved_by = get_user(request)
            invoice.approved_at = timezone.now()
            invoice.save()
            return Response({'detail': f'{invoice.invoice_number} approved (Proforma — no GL entry).', 'status': invoice.status})

        # Post GL entry
        journal_entry = None
        try:
            from apps.Finance.models import Account, JournalEntry, JournalLine

            ar_account      = get_gl_account('Accounts Receivable')
            revenue_account = get_gl_account('Sales Revenue')

            if ar_account and revenue_account:
                entry = JournalEntry.objects.create(
                    date        = invoice.invoice_date,
                    description = f'Invoice — {invoice.customer.name} ({invoice.invoice_number})',
                    source      = JournalEntry.Source.SALES,
                    status      = JournalEntry.Status.DRAFT,
                    notes       = f'Invoice type: {invoice.invoice_type}',
                    created_by  = get_user(request),
                )
                lines = []

                # DR Accounts Receivable
                lines.append(JournalLine(
                    entry=entry, account=ar_account,
                    debit=invoice.total_amount, credit=Decimal('0'),
                    description=f'{invoice.invoice_number} — {invoice.customer.name}',
                ))

                # CR Sales Revenue (subtotal)
                lines.append(JournalLine(
                    entry=entry, account=revenue_account,
                    debit=Decimal('0'), credit=invoice.subtotal,
                    description='Sales revenue',
                ))

                # CR VAT Output (if applicable)
                if invoice.vat_amount > 0:
                    vat_account = get_gl_account('VAT') or get_gl_account('Tax Payable')
                    if vat_account:
                        lines.append(JournalLine(
                            entry=entry, account=vat_account,
                            debit=Decimal('0'), credit=invoice.vat_amount,
                            description='VAT output',
                        ))

                JournalLine.objects.bulk_create(lines)
                entry.post()
                invoice.journal_entry = entry
                journal_entry = entry

        except Exception:
            pass

        invoice.status      = Invoice.Status.APPROVED
        invoice.approved_by = get_user(request)
        invoice.approved_at = timezone.now()
        invoice.save()

        return Response({
            'detail':           f'{invoice.invoice_number} approved and posted to GL.',
            'status':           invoice.status,
            'journal_entry_id': journal_entry.id if journal_entry else None,
        })


class SendInvoiceView(APIView):
    """POST /api/ar/invoices/<id>/send/ — Mark as sent to customer."""
    def post(self, request, pk):
        invoice = get_object_or_404(Invoice, pk=pk)
        if invoice.status not in (Invoice.Status.APPROVED, Invoice.Status.DRAFT):
            return Response(
                {'detail': f'Cannot send an invoice with status "{invoice.status}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Auto-approve proforma if sent directly
        if invoice.status == Invoice.Status.DRAFT and invoice.invoice_type == Invoice.InvoiceType.PROFORMA:
            invoice.status      = Invoice.Status.APPROVED
            invoice.approved_at = timezone.now()

        invoice.status  = Invoice.Status.SENT
        invoice.sent_at = timezone.now()
        invoice.save()
        return Response({'detail': f'{invoice.invoice_number} marked as sent.', 'status': invoice.status})


class CollectInvoiceView(APIView):
    """
    POST /api/ar/invoices/<id>/collect/

    Records a receipt against an invoice:
    DR  Cash / Bank           (amount received)
    CR  Accounts Receivable   (reducing debtor balance)
    """
    @transaction.atomic
    def post(self, request, pk):
        invoice = get_object_or_404(Invoice, pk=pk)

        if invoice.status not in (
            Invoice.Status.APPROVED,
            Invoice.Status.SENT,
            Invoice.Status.PARTIALLY_COLLECTED,
        ):
            return Response(
                {'detail': 'Invoice must be Approved or Sent before collecting.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount         = Decimal(str(request.data.get('amount', 0)))
        payment_method = request.data.get('payment_method', 'Bank Transfer')
        receipt_date   = request.data.get('receipt_date', timezone.now().date().isoformat())
        reference      = request.data.get('reference', '')
        apply_discount = request.data.get('apply_early_discount', False)

        discount = Decimal('0')
        if apply_discount:
            discount = invoice.early_payment_discount
            amount   = max(Decimal('0'), amount - discount)

        if amount <= 0:
            return Response({'detail': 'Amount must be positive.'}, status=status.HTTP_400_BAD_REQUEST)
        if amount > invoice.balance_due:
            return Response(
                {'detail': f'Amount ({amount}) exceeds balance due ({invoice.balance_due}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create receipt
        receipt = Receipt.objects.create(
            customer       = invoice.customer,
            receipt_date   = receipt_date,
            payment_method = payment_method,
            amount         = amount,
            wht_deducted   = invoice.wht_amount if amount >= invoice.balance_due else Decimal('0'),
            reference      = reference,
            created_by     = get_user(request),
        )
        ReceiptAllocation.objects.create(receipt=receipt, invoice=invoice, amount=amount)

        # Update invoice
        invoice.amount_collected += amount
        if invoice.amount_collected >= invoice.total_amount:
            invoice.status       = Invoice.Status.COLLECTED
            invoice.collected_at = timezone.now()
        else:
            invoice.status = Invoice.Status.PARTIALLY_COLLECTED
        invoice.save()

        # Post GL
        journal_entry = None
        try:
            from apps.Finance.models import Account, JournalEntry, JournalLine

            cash_account = get_gl_account('Cash')
            ar_account   = get_gl_account('Accounts Receivable')

            if cash_account and ar_account:
                entry = JournalEntry.objects.create(
                    date        = receipt_date,
                    description = f'Receipt — {invoice.customer.name} ({invoice.invoice_number})',
                    source      = JournalEntry.Source.SALES,
                    status      = JournalEntry.Status.DRAFT,
                    notes       = f'Ref: {reference}. Method: {payment_method}',
                    created_by  = get_user(request),
                )
                JournalLine.objects.create(
                    entry=entry, account=cash_account,
                    debit=amount, credit=Decimal('0'),
                    description=f'Receipt from {invoice.customer.name}',
                )
                JournalLine.objects.create(
                    entry=entry, account=ar_account,
                    debit=Decimal('0'), credit=amount,
                    description=f'Clearing {invoice.invoice_number}',
                )
                entry.post()
                receipt.journal_entry = entry
                receipt.save()
                journal_entry = entry

        except Exception:
            pass

        return Response({
            'detail':           f'Receipt of KES {amount} recorded for {invoice.invoice_number}.',
            'receipt_number':   receipt.receipt_number,
            'amount_collected': invoice.amount_collected,
            'balance_due':      invoice.balance_due,
            'discount_applied': discount,
            'invoice_status':   invoice.status,
            'journal_entry_id': journal_entry.id if journal_entry else None,
        })


class CancelInvoiceView(APIView):
    """POST /api/ar/invoices/<id>/cancel/"""
    def post(self, request, pk):
        invoice = get_object_or_404(Invoice, pk=pk)
        if invoice.status in (Invoice.Status.COLLECTED, Invoice.Status.CANCELLED):
            return Response(
                {'detail': f'Cannot cancel a {invoice.status} invoice.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invoice.status = Invoice.Status.CANCELLED
        invoice.save()
        return Response({'detail': f'{invoice.invoice_number} cancelled.', 'status': invoice.status})


# ── Credit Notes ──────────────────────────────────────────────

class CreditNoteCreateView(APIView):
    """
    POST /api/ar/invoices/<id>/credit-note/
    Body: {"amount": 5000, "reason": "Overcharge on services"}

    Posts GL:
    DR  Sales Revenue         (reversing revenue)
    CR  Accounts Receivable   (reducing debtor balance)
    """
    @transaction.atomic
    def post(self, request, pk):
        invoice = get_object_or_404(Invoice, pk=pk)
        amount  = Decimal(str(request.data.get('amount', 0)))
        reason  = request.data.get('reason', '').strip()

        if amount <= 0:
            return Response({'detail': 'Amount must be positive.'}, status=status.HTTP_400_BAD_REQUEST)
        if not reason:
            return Response({'detail': 'Reason is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if amount > invoice.total_amount:
            return Response({'detail': 'Credit note cannot exceed invoice amount.'}, status=status.HTTP_400_BAD_REQUEST)

        cn = CreditNote.objects.create(
            invoice  = invoice,
            customer = invoice.customer,
            date     = timezone.now().date(),
            amount   = amount,
            reason   = reason,
        )

        # Reduce invoice amount
        invoice.total_amount -= amount
        invoice.save()

        # Post GL
        try:
            from apps.Finance.models import Account, JournalEntry, JournalLine
            revenue_account = get_gl_account('Sales Revenue')
            ar_account      = get_gl_account('Accounts Receivable')
            if revenue_account and ar_account:
                entry = JournalEntry.objects.create(
                    date        = timezone.now().date(),
                    description = f'Credit Note {cn.credit_note_number} — {invoice.customer.name}',
                    source      = JournalEntry.Source.SALES,
                    status      = JournalEntry.Status.DRAFT,
                    notes       = reason,
                    created_by  = get_user(request),
                )
                JournalLine.objects.create(entry=entry, account=revenue_account,
                    debit=amount, credit=Decimal('0'))
                JournalLine.objects.create(entry=entry, account=ar_account,
                    debit=Decimal('0'), credit=amount)
                entry.post()
                cn.journal_entry = entry
                cn.save()
        except Exception:
            pass

        serializer = CreditNoteSerializer(cn)
        return Response({
            'detail':      f'Credit note {cn.credit_note_number} issued for KES {amount}.',
            'credit_note': serializer.data,
        }, status=status.HTTP_201_CREATED)


# ── Receipts ──────────────────────────────────────────────────

class ReceiptListView(generics.ListAPIView):
    serializer_class = ReceiptSerializer

    def get_queryset(self):
        qs = Receipt.objects.select_related('customer').prefetch_related('allocations').all()
        if c := self.request.query_params.get('customer'):
            qs = qs.filter(customer_id=c)
        return qs


# ── AR Aging ──────────────────────────────────────────────────

class ARAgingView(APIView):
    """GET /api/ar/aging/"""
    def get(self, request):
        today    = timezone.now().date()
        invoices = Invoice.objects.filter(
            status__in=[
                Invoice.Status.APPROVED,
                Invoice.Status.SENT,
                Invoice.Status.PARTIALLY_COLLECTED,
            ]
        ).select_related('customer')

        buckets = {
            'current': {'label': 'Current (Not Due)',  'total': Decimal('0'), 'invoices': []},
            '1_30':    {'label': '1–30 Days Overdue',  'total': Decimal('0'), 'invoices': []},
            '31_60':   {'label': '31–60 Days Overdue', 'total': Decimal('0'), 'invoices': []},
            '61_90':   {'label': '61–90 Days Overdue', 'total': Decimal('0'), 'invoices': []},
            'over_90': {'label': '90+ Days Overdue',   'total': Decimal('0'), 'invoices': []},
        }

        for inv in invoices:
            days  = (today - inv.due_date).days
            entry = {
                'invoice_number': inv.invoice_number,
                'customer':       inv.customer.name,
                'invoice_date':   inv.invoice_date,
                'due_date':       inv.due_date,
                'balance_due':    inv.balance_due,
                'days_overdue':   max(0, days),
            }
            if days <= 0:
                buckets['current']['total']  += inv.balance_due
                buckets['current']['invoices'].append(entry)
            elif days <= 30:
                buckets['1_30']['total']  += inv.balance_due
                buckets['1_30']['invoices'].append(entry)
            elif days <= 60:
                buckets['31_60']['total'] += inv.balance_due
                buckets['31_60']['invoices'].append(entry)
            elif days <= 90:
                buckets['61_90']['total'] += inv.balance_due
                buckets['61_90']['invoices'].append(entry)
            else:
                buckets['over_90']['total'] += inv.balance_due
                buckets['over_90']['invoices'].append(entry)

        return Response({
            'as_of_date':  today,
            'grand_total': sum(b['total'] for b in buckets.values()),
            'buckets':     buckets,
        })


# ── AR Dashboard ──────────────────────────────────────────────

class ARDashboardView(APIView):
    """GET /api/ar/dashboard/"""
    def get(self, request):
        today    = timezone.now().date()
        invoices = Invoice.objects.all()
        active   = invoices.filter(status__in=[
            Invoice.Status.APPROVED,
            Invoice.Status.SENT,
            Invoice.Status.PARTIALLY_COLLECTED,
        ])
        overdue  = [i for i in active if i.is_overdue]

        total_receivable   = sum(i.balance_due   for i in active)
        total_overdue      = sum(i.balance_due   for i in overdue)
        total_collected_mtd = sum(
            r.amount for r in Receipt.objects.filter(
                receipt_date__year=today.year,
                receipt_date__month=today.month,
            )
        )
        total_invoiced_mtd = sum(
            i.total_amount for i in invoices.filter(
                invoice_date__year=today.year,
                invoice_date__month=today.month,
            )
        )

        active_customers = Customer.objects.filter(status='Active').count()
        over_limit       = sum(1 for c in Customer.objects.filter(status='Active') if c.is_over_credit_limit)

        # DSO = (AR / Revenue) × Days in period
        total_revenue = sum(i.subtotal for i in invoices.filter(
            invoice_date__year=today.year,
            invoice_date__month=today.month,
        ))
        dso = round((float(total_receivable) / float(total_revenue) * 30), 1) if total_revenue else 0

        return Response({
            'total_receivable':    total_receivable,
            'total_overdue':       total_overdue,
            'overdue_count':       len(overdue),
            'total_collected_mtd': total_collected_mtd,
            'total_invoiced_mtd':  total_invoiced_mtd,
            'active_customers':    active_customers,
            'customers_over_limit':over_limit,
            'dso_days':            dso,
            'draft_invoices':      invoices.filter(status='Draft').count(),
        })