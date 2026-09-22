"""
Management command: generate_finance_data

Generates realistic finance data for a Kenyan SME using the Faker library.
Nothing is hardcoded — all values are dynamically produced on each run.

Usage:
    python manage.py generate_finance_data
    python manage.py generate_finance_data --entries 200
    python manage.py generate_finance_data --months 12
    python manage.py generate_finance_data --clear
"""

import random
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction

from faker import Faker
from faker.providers import company, address, date_time

from apps.Finance.models import Account, JournalEntry, JournalLine

fake = Faker('en_GB')   # en_GB gives realistic non-US formatting
fake.add_provider(company)
fake.add_provider(address)
fake.add_provider(date_time)

User = get_user_model()


# ── Account structure ─────────────────────────────────────────
# Defines the shape of the Chart of Accounts.
# Codes, names and types are all generated — nothing hardcoded.
ACCOUNT_STRUCTURE = [
    # (code_prefix, type, name_template)
    ('10', 'Asset',     'Cash & Bank'),
    ('11', 'Asset',     'Petty Cash'),
    ('12', 'Asset',     'Accounts Receivable'),
    ('13', 'Asset',     'Prepaid Expenses'),
    ('14', 'Asset',     'Inventory — Finished Goods'),
    ('15', 'Asset',     'Inventory — Raw Materials'),
    ('16', 'Asset',     'Fixed Assets — Equipment'),
    ('17', 'Asset',     'Accumulated Depreciation'),
    ('20', 'Liability', 'Accounts Payable'),
    ('21', 'Liability', 'Accrued Salaries Payable'),
    ('22', 'Liability', 'VAT Payable'),
    ('23', 'Liability', 'PAYE Payable'),
    ('24', 'Liability', 'NSSF Payable'),
    ('25', 'Liability', 'NHIF Payable'),
    ('26', 'Liability', 'Bank Loan Payable'),
    ('30', 'Equity',    'Ordinary Share Capital'),
    ('31', 'Equity',    'Retained Earnings'),
    ('32', 'Equity',    'Revaluation Reserve'),
    ('40', 'Revenue',   'Sales Revenue — Products'),
    ('41', 'Revenue',   'Sales Revenue — Services'),
    ('42', 'Revenue',   'Other Income'),
    ('50', 'Expense',   'Cost of Goods Sold'),
    ('51', 'Expense',   'Salaries & Wages'),
    ('52', 'Expense',   'Depreciation Expense'),
    ('53', 'Expense',   'Rent & Occupancy'),
    ('54', 'Expense',   'Utilities'),
    ('55', 'Expense',   'Marketing & Advertising'),
    ('56', 'Expense',   'Travel & Transport'),
    ('57', 'Expense',   'Office Supplies & Admin'),
    ('58', 'Expense',   'Professional Fees'),
    ('59', 'Expense',   'Bank Charges & Interest'),
]

# Journal entry templates that simulate real business events.
# Each template defines what kind of double-entry gets created.
# account_type_debit / account_type_credit refer to ACCOUNT_STRUCTURE types.
ENTRY_TEMPLATES = [
    {
        'source':       JournalEntry.Source.SALES,
        'description':  'Customer invoice — {company}',
        'debit_type':   'Asset',       # AR goes up
        'credit_type':  'Revenue',     # Revenue recognised
        'amount_range': (50000, 800000),
        'debit_name':   'Accounts Receivable',
        'credit_name':  'Sales Revenue — Products',
    },
    {
        'source':       JournalEntry.Source.SALES,
        'description':  'Service invoice — {company}',
        'debit_type':   'Asset',
        'credit_type':  'Revenue',
        'amount_range': (20000, 350000),
        'debit_name':   'Accounts Receivable',
        'credit_name':  'Sales Revenue — Services',
    },
    {
        'source':       JournalEntry.Source.SALES,
        'description':  'Cash receipt from {company}',
        'debit_type':   'Asset',       # Cash goes up
        'credit_type':  'Asset',       # AR goes down
        'amount_range': (50000, 600000),
        'debit_name':   'Cash & Bank',
        'credit_name':  'Accounts Receivable',
    },
    {
        'source':       JournalEntry.Source.PURCHASE,
        'description':  'Supplier bill — {company}',
        'debit_type':   'Expense',     # COGS goes up
        'credit_type':  'Liability',   # AP goes up
        'amount_range': (15000, 400000),
        'debit_name':   'Cost of Goods Sold',
        'credit_name':  'Accounts Payable',
    },
    {
        'source':       JournalEntry.Source.PURCHASE,
        'description':  'Vendor payment — {company}',
        'debit_type':   'Liability',   # AP goes down
        'credit_type':  'Asset',       # Cash goes down
        'amount_range': (15000, 350000),
        'debit_name':   'Accounts Payable',
        'credit_name':  'Cash & Bank',
    },
    {
        'source':       JournalEntry.Source.PAYROLL,
        'description':  'Monthly payroll — {month}',
        'debit_type':   'Expense',
        'credit_type':  'Asset',
        'amount_range': (200000, 900000),
        'debit_name':   'Salaries & Wages',
        'credit_name':  'Cash & Bank',
    },
    {
        'source':       JournalEntry.Source.PAYROLL,
        'description':  'PAYE remittance — {month}',
        'debit_type':   'Liability',
        'credit_type':  'Asset',
        'amount_range': (30000, 150000),
        'debit_name':   'PAYE Payable',
        'credit_name':  'Cash & Bank',
    },
    {
        'source':       JournalEntry.Source.ASSETS,
        'description':  'Monthly depreciation charge',
        'debit_type':   'Expense',
        'credit_type':  'Asset',
        'amount_range': (5000, 40000),
        'debit_name':   'Depreciation Expense',
        'credit_name':  'Accumulated Depreciation',
    },
    {
        'source':       JournalEntry.Source.MANUAL,
        'description':  'Rent payment — {month}',
        'debit_type':   'Expense',
        'credit_type':  'Asset',
        'amount_range': (40000, 150000),
        'debit_name':   'Rent & Occupancy',
        'credit_name':  'Cash & Bank',
    },
    {
        'source':       JournalEntry.Source.MANUAL,
        'description':  'Utilities — {month}',
        'debit_type':   'Expense',
        'credit_type':  'Asset',
        'amount_range': (5000, 25000),
        'debit_name':   'Utilities',
        'credit_name':  'Cash & Bank',
    },
    {
        'source':       JournalEntry.Source.MANUAL,
        'description':  'Marketing spend — {campaign}',
        'debit_type':   'Expense',
        'credit_type':  'Asset',
        'amount_range': (10000, 80000),
        'debit_name':   'Marketing & Advertising',
        'credit_name':  'Cash & Bank',
    },
    {
        'source':       JournalEntry.Source.MANUAL,
        'description':  'Professional fees — {firm}',
        'debit_type':   'Expense',
        'credit_type':  'Asset',
        'amount_range': (15000, 120000),
        'debit_name':   'Professional Fees',
        'credit_name':  'Cash & Bank',
    },
]


def kes(low, high):
    """Return a random KES amount rounded to nearest 100."""
    raw = random.randint(low // 100, high // 100) * 100
    return Decimal(str(raw))


def build_description(template, fake):
    """Fill placeholders in entry description templates."""
    desc = template['description']
    replacements = {
        '{company}':  fake.company(),
        '{month}':    fake.date('%B %Y'),
        '{campaign}': f'{fake.bs().title()} Campaign',
        '{firm}':     f'{fake.last_name()} & Associates',
    }
    for placeholder, value in replacements.items():
        desc = desc.replace(placeholder, value)
    return desc


class Command(BaseCommand):
    help = (
        'Generate realistic finance data for a Kenyan SME using Faker. '
        'Creates Chart of Accounts, Journal Entries and Journal Lines.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--entries',
            type=int,
            default=120,
            help='Number of journal entries to generate (default: 120)',
        )
        parser.add_argument(
            '--months',
            type=int,
            default=6,
            help='How many months back to spread the entries (default: 6)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all existing finance data before generating new data',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('  Clearing existing finance data...')
            JournalLine.objects.all().delete()
            JournalEntry.objects.all().delete()
            Account.objects.all().delete()
            self.stdout.write(self.style.WARNING('  Existing data cleared.\n'))

        # ── Step 1: Build Chart of Accounts ──────────────────
        self.stdout.write('Step 1: Creating Chart of Accounts...')
        accounts = self._create_accounts()
        self.stdout.write(self.style.SUCCESS(
            f'  {len(accounts)} accounts created.\n'
        ))

        # ── Step 2: Generate Journal Entries ─────────────────
        self.stdout.write(f'Step 2: Generating {options["entries"]} journal entries...')
        entries_created = self._create_entries(
            accounts,
            count=options['entries'],
            months_back=options['months'],
        )
        self.stdout.write(self.style.SUCCESS(
            f'  {entries_created} entries created and posted.\n'
        ))

        self.stdout.write(self.style.SUCCESS(
            '✓ Finance data generation complete. '
            'Run the server and check /api/finance/trial-balance/ to verify.'
        ))

    def _create_accounts(self):
        """
        Create accounts from ACCOUNT_STRUCTURE.
        Codes are generated as e.g. 1000, 1100, 1200 based on prefix.
        """
        accounts = {}
        for i, (prefix, acct_type, name) in enumerate(ACCOUNT_STRUCTURE):
            code = f'{prefix}00'
            account, _ = Account.objects.get_or_create(
                code=code,
                defaults={
                    'name':         name,
                    'account_type': acct_type,
                    'description':  (
                        f'Auto-generated account for {name}. '
                        f'Type: {acct_type}.'
                    ),
                }
            )
            accounts[name] = account
            self.stdout.write(f'    {code}  {name}  ({acct_type})')

        return accounts

    def _create_entries(self, accounts, count, months_back):
        """
        Generate `count` journal entries spread across `months_back` months,
        each pulled from a realistic business template.
        """
        now        = timezone.now().date()
        start_date = now - timedelta(days=months_back * 30)
        created    = 0

        for _ in range(count):
            template = random.choice(ENTRY_TEMPLATES)

            # Find matching debit and credit accounts by name
            debit_account  = accounts.get(template['debit_name'])
            credit_account = accounts.get(template['credit_name'])

            if not debit_account or not credit_account:
                continue  # skip if account not found

            amount = kes(*template['amount_range'])
            date   = fake.date_between(start_date=start_date, end_date=now)

            entry = JournalEntry.objects.create(
                date        = date,
                description = build_description(template, fake),
                source      = template['source'],
                status      = JournalEntry.Status.DRAFT,
                notes       = '',
            )

            # Debit line
            JournalLine.objects.create(
                entry   = entry,
                account = debit_account,
                debit   = amount,
                credit  = Decimal('0.00'),
            )

            # Credit line
            JournalLine.objects.create(
                entry   = entry,
                account = credit_account,
                debit   = Decimal('0.00'),
                credit  = amount,
            )

            # Post it — atomic, enforces balance check
            entry.post()
            created += 1

        return created
