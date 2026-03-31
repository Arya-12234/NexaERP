from django.shortcuts import render

# Create your views here.
from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from decimal import Decimal

from .models import Account, JournalEntry, JournalLine
from .serializers import (
    AccountSerializer,
    JournalEntrySerializer,
    JournalEntryListSerializer,
    TrialBalanceRowSerializer,
)


# ── Chart of Accounts ─────────────────────────────────────────

class AccountListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/finance/accounts/       — list all accounts
    POST /api/finance/accounts/       — create a new account
    """
    serializer_class = AccountSerializer

    def get_queryset(self):
        qs = Account.objects.filter(is_active=True)
        account_type = self.request.query_params.get('type')
        if account_type:
            qs = qs.filter(account_type__iexact=account_type)
        return qs


class AccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/finance/accounts/<id>/  — retrieve account + live balance
    PUT    /api/finance/accounts/<id>/  — update account
    DELETE /api/finance/accounts/<id>/  — soft-delete (sets is_active=False)
    """
    serializer_class = AccountSerializer
    queryset = Account.objects.all()

    def destroy(self, request, *args, **kwargs):
        account = self.get_object()
        # Soft delete — never hard-delete accounts that have journal lines
        account.is_active = False
        account.save()
        return Response(
            {'detail': 'Account deactivated.'},
            status=status.HTTP_200_OK
        )


# ── Journal Entries ───────────────────────────────────────────

class JournalEntryListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/finance/journal-entries/       — list entries (lightweight)
    POST /api/finance/journal-entries/       — create a new draft entry
    
    Supports query params:
      ?status=Posted|Draft|Pending|Void
      ?source=Manual|Payroll|Sales|...
      ?date_from=YYYY-MM-DD
      ?date_to=YYYY-MM-DD
    """
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return JournalEntrySerializer
        return JournalEntryListSerializer

    def get_queryset(self):
        qs = JournalEntry.objects.all()

        status_param = self.request.query_params.get('status')
        source_param = self.request.query_params.get('source')
        date_from    = self.request.query_params.get('date_from')
        date_to      = self.request.query_params.get('date_to')

        if status_param:
            qs = qs.filter(status__iexact=status_param)
        if source_param:
            qs = qs.filter(source__iexact=source_param)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)


class JournalEntryDetailView(generics.RetrieveAPIView):
    """
    GET /api/finance/journal-entries/<id>/  — full entry with all lines
    """
    serializer_class = JournalEntrySerializer
    queryset = JournalEntry.objects.prefetch_related('lines__account').all()


class PostJournalEntryView(APIView):
    """
    POST /api/finance/journal-entries/<id>/post/

    Posts a Draft or Pending journal entry.
    Enforces double-entry balance inside an atomic transaction.
    Returns 400 if debits ≠ credits or entry is already posted/voided.
    """
    def post(self, request, pk):
        entry = get_object_or_404(JournalEntry, pk=pk)
        try:
            entry.post()
        except ValidationError as e:
            return Response(
                {'detail': str(e.message)},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = JournalEntrySerializer(entry)
        return Response(serializer.data, status=status.HTTP_200_OK)


class VoidJournalEntryView(APIView):
    """
    POST /api/finance/journal-entries/<id>/void/

    Voids a posted entry. Does NOT delete it — preserves audit trail.
    Creates a reversing entry automatically.
    """
    def post(self, request, pk):
        entry = get_object_or_404(JournalEntry, pk=pk)

        if entry.status != JournalEntry.Status.POSTED:
            return Response(
                {'detail': 'Only posted entries can be voided.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mark original as void
        entry.status = JournalEntry.Status.VOID
        entry.save()

        # Create reversing entry (swap debits/credits)
        reversing = JournalEntry.objects.create(
            date        = entry.date,
            description = f'VOID: {entry.description}',
            source      = JournalEntry.Source.SYSTEM,
            status      = JournalEntry.Status.POSTED,
            notes       = f'Auto-reversing entry for {entry.reference}',
            created_by  = request.user if request.user.is_authenticated else None,
        )
        for line in entry.lines.all():
            JournalLine.objects.create(
                entry   = reversing,
                account = line.account,
                debit   = line.credit,   # swap
                credit  = line.debit,    # swap
            )

        serializer = JournalEntrySerializer(reversing)
        return Response(
            {
                'detail': f'{entry.reference} voided. Reversing entry created.',
                'reversing_entry': serializer.data,
            },
            status=status.HTTP_200_OK,
        )


# ── Trial Balance ─────────────────────────────────────────────

class TrialBalanceView(APIView):
    """
    GET /api/finance/trial-balance/

    Returns all accounts with their debit/credit balances from posted entries.
    Also returns totals and a balanced flag.

    Optional query params:
      ?date_from=YYYY-MM-DD
      ?date_to=YYYY-MM-DD
    """
    def get(self, request):
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')

        posted_entries = JournalEntry.objects.filter(status=JournalEntry.Status.POSTED)
        if date_from:
            posted_entries = posted_entries.filter(date__gte=date_from)
        if date_to:
            posted_entries = posted_entries.filter(date__lte=date_to)

        accounts = Account.objects.filter(is_active=True).order_by('code')
        rows = []
        total_debit  = Decimal('0.00')
        total_credit = Decimal('0.00')

        for account in accounts:
            lines = JournalLine.objects.filter(
                entry__in=posted_entries,
                account=account,
            )
            dr = sum(l.debit  for l in lines) or Decimal('0.00')
            cr = sum(l.credit for l in lines) or Decimal('0.00')

            if dr == 0 and cr == 0:
                continue  # skip accounts with no activity

            rows.append({
                'code':         account.code,
                'name':         account.name,
                'account_type': account.account_type,
                'debit':        dr,
                'credit':       cr,
            })
            total_debit  += dr
            total_credit += cr

        return Response({
            'accounts':    rows,
            'total_debit':  total_debit,
            'total_credit': total_credit,
            'balanced':     total_debit == total_credit,
            'date_from':    date_from,
            'date_to':      date_to,
        })