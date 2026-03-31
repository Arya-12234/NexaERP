from django.db import models

# Create your models here.
from django.db import models
from django.db import transaction
from django.core.exceptions import ValidationError
from decimal import Decimal


class Account(models.Model):
    """
    Chart of Accounts entry.
    Every financial transaction must map to an account here.
    """
    class AccountType(models.TextChoices):
        ASSET     = 'Asset',     'Asset'
        LIABILITY = 'Liability', 'Liability'
        EQUITY    = 'Equity',    'Equity'
        REVENUE   = 'Revenue',   'Revenue'
        EXPENSE   = 'Expense',   'Expense'

    code        = models.CharField(max_length=20, unique=True)
    name        = models.CharField(max_length=120)
    account_type= models.CharField(max_length=20, choices=AccountType.choices)
    description = models.TextField(blank=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f'{self.code} — {self.name}'

    @property
    def balance(self):
        """
        Computes running balance from all posted journal lines.
        Assets & Expenses:   balance = total debits  - total credits
        Liabilities, Equity, Revenue: balance = total credits - total debits
        """
        lines = self.journal_lines.filter(entry__status=JournalEntry.Status.POSTED)
        total_debit  = sum(l.debit  for l in lines)
        total_credit = sum(l.credit for l in lines)

        if self.account_type in (self.AccountType.ASSET, self.AccountType.EXPENSE):
            return total_debit - total_credit
        return total_credit - total_debit


class JournalEntry(models.Model):
    """
    A Journal Entry is the atomic unit of accounting.
    It contains 2+ JournalLines where SUM(debits) must equal SUM(credits).
    This enforces Double-Entry Bookkeeping at the database level.
    """
    class Status(models.TextChoices):
        DRAFT   = 'Draft',   'Draft'
        PENDING = 'Pending', 'Pending'
        POSTED  = 'Posted',  'Posted'
        VOID    = 'Void',    'Void'

    class Source(models.TextChoices):
        MANUAL   = 'Manual',  'Manual'
        PAYROLL  = 'Payroll', 'Payroll'
        SALES    = 'Sales',   'Sales'
        PURCHASE = 'Purchase','Purchase'
        ASSETS   = 'Assets',  'Assets'
        SYSTEM   = 'System',  'System'

    reference   = models.CharField(max_length=30, unique=True, editable=False)
    date        = models.DateField()
    description = models.CharField(max_length=255)
    source      = models.CharField(max_length=20, choices=Source.choices, default=Source.MANUAL)
    status      = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    created_by  = models.ForeignKey(
                    'auth.User', null=True, blank=True,
                    on_delete=models.SET_NULL, related_name='journal_entries'
                  )
    created_at  = models.DateTimeField(auto_now_add=True)
    posted_at   = models.DateTimeField(null=True, blank=True)
    notes       = models.TextField(blank=True)

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name_plural = 'Journal Entries'

    def __str__(self):
        return f'{self.reference} | {self.date} | {self.description}'

    def save(self, *args, **kwargs):
        # Auto-generate reference like JE-000042
        if not self.reference:
            super().save(*args, **kwargs)
            self.reference = f'JE-{self.pk:06d}'
            kwargs['force_insert'] = False
        super().save(*args, **kwargs)

    def get_total_debits(self):
        return sum(l.debit for l in self.lines.all())

    def get_total_credits(self):
        return sum(l.credit for l in self.lines.all())

    def is_balanced(self):
        return self.get_total_debits() == self.get_total_credits()

    @transaction.atomic
    def post(self):
        """
        Posts the entry after validating double-entry balance.
        Uses an atomic transaction — if anything fails, nothing is saved.
        """
        from django.utils import timezone

        if self.status == self.Status.POSTED:
            raise ValidationError('This entry has already been posted.')
        if self.status == self.Status.VOID:
            raise ValidationError('Cannot post a voided entry.')
        if self.lines.count() < 2:
            raise ValidationError('A journal entry must have at least 2 lines.')
        if not self.is_balanced():
            raise ValidationError(
                f'Entry is not balanced. '
                f'Debits: {self.get_total_debits()}, '
                f'Credits: {self.get_total_credits()}'
            )

        self.status    = self.Status.POSTED
        self.posted_at = timezone.now()
        self.save()


class JournalLine(models.Model):
    """
    A single debit or credit line within a Journal Entry.
    Each line belongs to exactly one Account.
    Either debit > 0 OR credit > 0, never both.
    """
    entry       = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account     = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='journal_lines')
    description = models.CharField(max_length=255, blank=True)
    debit       = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit      = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        ordering = ['id']

    def __str__(self):
        if self.debit > 0:
            return f'DR {self.account.code} {self.debit}'
        return f'CR {self.account.code} {self.credit}'

    def clean(self):
        if self.debit < 0 or self.credit < 0:
            raise ValidationError('Debit and credit values cannot be negative.')
        if self.debit > 0 and self.credit > 0:
            raise ValidationError('A line cannot have both a debit and a credit.')
        if self.debit == 0 and self.credit == 0:
            raise ValidationError('A line must have either a debit or a credit value.')

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)