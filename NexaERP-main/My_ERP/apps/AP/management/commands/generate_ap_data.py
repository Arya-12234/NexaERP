"""
Management command: generate_ap_data

Generates realistic Kenyan vendor and bill data using Faker.

Usage:
    python manage.py generate_ap_data
    python manage.py generate_ap_data --vendors 30 --bills 80
    python manage.py generate_ap_data --clear
"""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from faker import Faker

from apps.AP.models import Vendor, Bill, BillLine, Payment, PaymentAllocation

fake = Faker('en_GB')

KENYAN_COMPANIES = [
    'Safaricom PLC', 'Kenya Power & Lighting', 'Equity Bank Kenya',
    'East African Breweries', 'Nation Media Group', 'Bamburi Cement',
    'Kenyan Alliance Insurance', 'Jubilee Holdings', 'Stanbic Bank Kenya',
    'Total Energies Kenya', 'Haco Industries', 'Bidco Africa',
    'Davis & Shirtliff', 'Techno Brain Kenya', 'Computer Point Ltd',
    'Toyota Kenya Ltd', 'CMC Motors Group', 'Deloitte East Africa',
    'KPMG Kenya', 'PricewaterhouseCoopers Kenya', 'Ernst & Young Kenya',
    'Strathmore University', 'Nairobi Business Park', 'Two Rivers Mall',
    'Kenya Airways', 'KQ Cargo', 'DHL Kenya', 'G4S Kenya',
    'Securex Agencies', 'Fahari Telecoms', 'Liquid Telecom Kenya',
    'Wananchi Group', 'Zuku Fiber', 'Kenya Red Cross',
    'Twiga Foods', 'Copia Kenya', 'Sokowatch Kenya',
]

BILL_DESCRIPTIONS = {
    'Supplier': [
        ('Office Supplies & Stationery',     500,    15000,   0,   16),
        ('IT Equipment Purchase',            50000,  500000,  3,   16),
        ('Furniture Purchase',               20000,  200000,  3,   16),
        ('Raw Materials',                    10000,  300000,  3,   16),
        ('Packaging Materials',              5000,   80000,   3,   16),
    ],
    'Contractor': [
        ('Building Maintenance Services',    15000,  200000,  3,   16),
        ('Electrical Installation Works',    20000,  150000,  3,   16),
        ('Plumbing & Sanitation Services',   10000,  80000,   3,   16),
        ('CCTV Installation & Maintenance',  25000,  120000,  3,   16),
        ('Cleaning Services',                10000,  50000,   3,   0 ),
    ],
    'Consultant': [
        ('Legal Advisory Services',          50000,  500000,  5,   16),
        ('Tax Consultancy Services',         30000,  300000,  5,   16),
        ('IT Consultancy & Support',         20000,  200000,  5,   16),
        ('HR Consultancy',                   25000,  150000,  5,   16),
        ('Financial Advisory Services',      40000,  400000,  5,   16),
    ],
    'Utility': [
        ('Electricity Bill',                 5000,   80000,   0,   0 ),
        ('Water Bill',                       2000,   15000,   0,   0 ),
        ('Internet & Connectivity',          8000,   50000,   0,   16),
        ('Telephone Bill',                   3000,   20000,   0,   16),
    ],
    'Landlord': [
        ('Monthly Office Rent',              50000,  500000,  10,  0 ),
        ('Warehouse Rent',                   30000,  200000,  10,  0 ),
        ('Parking Fees',                     5000,   20000,   10,  0 ),
    ],
}

WHT_MAP = {
    'Supplier':   'Contracts',
    'Contractor': 'Contracts',
    'Consultant': 'Consultancy',
    'Utility':    'None',
    'Landlord':   'Rent',
}

BANKS = [
    'Equity Bank', 'KCB Bank', 'Co-operative Bank',
    'Standard Chartered', 'NCBA Bank', 'Absa Bank',
]


def kenyan_kra_pin():
    import random
    letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    return f'P{random.randint(100000000, 999999999)}{random.choice(letters)}'


class Command(BaseCommand):
    help = 'Generate realistic AP vendor and bill data'

    def add_arguments(self, parser):
        parser.add_argument('--vendors', type=int, default=20,
                            help='Number of vendors to generate (default: 20)')
        parser.add_argument('--bills', type=int, default=60,
                            help='Number of bills to generate (default: 60)')
        parser.add_argument('--clear', action='store_true',
                            help='Clear existing AP data before generating')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('  Clearing existing AP data...')
            PaymentAllocation.objects.all().delete()
            Payment.objects.all().delete()
            BillLine.objects.all().delete()
            Bill.objects.all().delete()
            Vendor.objects.all().delete()
            self.stdout.write(self.style.WARNING('  Cleared.\n'))

        # Step 1: Create vendors
        self.stdout.write(f'Step 1: Creating {options["vendors"]} vendors...')
        vendors = []
        company_names = random.sample(KENYAN_COMPANIES, min(options['vendors'], len(KENYAN_COMPANIES)))

        for name in company_names:
            vendor_type = random.choice(['Supplier', 'Contractor', 'Consultant', 'Utility', 'Landlord'])
            credit_limit = random.choice([0, 0, 100000, 200000, 500000, 1000000])
            discount_pct = random.choice([0, 0, 0, 1, 2, 2.5])
            v = Vendor.objects.create(
                name                      = name,
                vendor_type               = vendor_type,
                status                    = 'Active',
                contact_person            = fake.name(),
                email                     = fake.company_email(),
                phone                     = f'07{random.randint(10000000, 99999999)}',
                address                   = fake.street_address(),
                city                      = random.choice(['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru']),
                kra_pin                   = kenyan_kra_pin(),
                vat_number                = f'VAT{random.randint(100000000, 999999999)}',
                wht_category              = WHT_MAP.get(vendor_type, 'None'),
                bank_name                 = random.choice(BANKS),
                bank_branch               = fake.city(),
                account_number            = str(random.randint(1000000000, 9999999999)),
                account_name              = name,
                credit_limit              = credit_limit,
                payment_terms_days        = random.choice([14, 30, 45, 60]),
                early_payment_discount_pct= discount_pct,
                early_payment_days        = 10 if discount_pct > 0 else 0,
            )
            vendors.append(v)
            self.stdout.write(f'    {v.vendor_number}  {v.name}  ({vendor_type})')

        # Step 2: Generate bills
        self.stdout.write(f'\nStep 2: Generating {options["bills"]} bills...')
        today = date(2026, 3, 19)
        bills_created = 0

        for _ in range(options['bills']):
            vendor       = random.choice(vendors)
            vtype        = vendor.vendor_type
            templates    = BILL_DESCRIPTIONS.get(vtype, BILL_DESCRIPTIONS['Supplier'])
            desc, lo, hi, wht_pct, vat_pct = random.choice(templates)

            bill_date    = fake.date_between(start_date=date(2025, 9, 1), end_date=today)
            due_date     = bill_date + timedelta(days=vendor.payment_terms_days)
            unit_price   = random.randint(lo // 1000, hi // 1000) * 1000
            quantity     = random.choice([1, 1, 1, 2, 3])

            # Determine bill status with realistic distribution
            status_weight = random.random()
            if status_weight < 0.10:
                bill_status = 'Draft'
            elif status_weight < 0.15:
                bill_status = 'Submitted'
            elif status_weight < 0.20:
                bill_status = 'Approved_Procurement'
            elif status_weight < 0.25:
                bill_status = 'Rejected'
            elif status_weight < 0.65:
                bill_status = 'Approved_Finance'
            elif status_weight < 0.80:
                bill_status = 'Partially_Paid'
            else:
                bill_status = 'Paid'

            subtotal     = Decimal(str(unit_price * quantity))
            vat_amount   = (subtotal * Decimal(str(vat_pct)) / 100).quantize(Decimal('0.01'))
            wht_amount   = (subtotal * Decimal(str(wht_pct)) / 100).quantize(Decimal('0.01'))
            total_amount = subtotal + vat_amount - wht_amount

            bill = Bill.objects.create(
                vendor          = vendor,
                bill_type       = 'Invoice',
                vendor_ref      = fake.bothify(text='INV-######'),
                bill_date       = bill_date,
                due_date        = due_date,
                received_date   = bill_date,
                subtotal        = subtotal,
                vat_amount      = vat_amount,
                wht_amount      = wht_amount,
                discount_amount = Decimal('0'),
                total_amount    = total_amount,
                status          = bill_status,
                notes           = f'Auto-generated bill for {desc}',
            )

            BillLine.objects.create(
                bill        = bill,
                description = desc,
                quantity    = quantity,
                unit_price  = unit_price,
                vat_rate    = vat_pct,
            )

            # Add partial/full payment for paid bills
            if bill_status in ('Partially_Paid', 'Paid'):
                pay_amount = total_amount if bill_status == 'Paid' else (total_amount * Decimal('0.5')).quantize(Decimal('0.01'))
                payment = Payment.objects.create(
                    vendor         = vendor,
                    payment_date   = due_date - timedelta(days=random.randint(0, 10)),
                    payment_method = random.choice(['Bank Transfer', 'Bank Transfer', 'Cheque']),
                    amount         = pay_amount,
                    wht_deducted   = wht_amount if bill_status == 'Paid' else Decimal('0'),
                    reference      = fake.bothify(text='TRF-######'),
                )
                PaymentAllocation.objects.create(payment=payment, bill=bill, amount=pay_amount)
                bill.amount_paid = pay_amount
                if bill_status == 'Paid':
                    bill.paid_at = timezone.now() if hasattr(timezone, 'now') else None
                bill.save()

            bills_created += 1
            self.stdout.write(f'    {bill.bill_number}  {vendor.name}  KES {total_amount:,}  [{bill_status}]')

        self.stdout.write(self.style.SUCCESS(
            f'\n✓ Done. {len(vendors)} vendors and {bills_created} bills created.'
        ))
        self.stdout.write(
            'Next:\n'
            '  GET  /api/ap/dashboard/\n'
            '  GET  /api/ap/aging/\n'
            '  GET  /api/ap/vendors/\n'
            '  GET  /api/ap/bills/\n'
        )


# Fix missing import
from django.utils import timezone