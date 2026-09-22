"""
Management command: generate_ar_data

Generates realistic Kenyan customer and invoice data using Faker.

Usage:
    python manage.py generate_ar_data
    python manage.py generate_ar_data --customers 25 --invoices 80
    python manage.py generate_ar_data --clear
"""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from faker import Faker

from apps.AR.models import Customer, Invoice, InvoiceLine, Receipt, ReceiptAllocation

fake = Faker('en_GB')

KENYAN_CUSTOMERS = [
    'Safaricom PLC', 'Kenya Commercial Bank', 'Equity Group Holdings',
    'East African Breweries', 'Nation Media Group', 'Kenya Airways',
    'Bamburi Cement', 'Jubilee Insurance', 'Stanbic Bank Kenya',
    'Total Energies Kenya', 'Twiga Foods', 'Copia Global',
    'M-Kopa Solar', 'Sanergy Kenya', 'Africa Improved Foods',
    'Nairobi Hospital', 'Aga Khan Hospital', 'MP Shah Hospital',
    'Strathmore University', 'University of Nairobi', 'KCA University',
    'Kenya Pipeline Company', 'Kenya Ports Authority', 'Kenya Power',
    'Telkom Kenya', 'Wananchi Group', 'Liquid Intelligent Technologies',
    'G4S Kenya', 'Securex Agencies', 'KenGen',
    'EABL Distribution', 'Bidco Africa', 'Haco Industries',
]

SERVICES = {
    'Corporate': [
        ('IT Support & Maintenance Services',    50000,  300000,  16),
        ('Software Development Services',        100000, 800000,  16),
        ('Management Consulting Services',       80000,  500000,  16),
        ('Training & Capacity Building',         30000,  200000,  16),
        ('Annual Software License',              20000,  150000,  16),
        ('Cloud Hosting Services',               15000,  100000,  16),
        ('Cybersecurity Assessment',             60000,  400000,  16),
        ('Data Analytics Services',              40000,  300000,  16),
    ],
    'Government': [
        ('ICT Infrastructure Supply',           200000, 2000000, 16),
        ('System Implementation Services',      500000, 5000000, 16),
        ('Maintenance & Support Contract',      100000, 800000,  16),
        ('Training Program Delivery',            50000,  300000,  16),
    ],
    'SME': [
        ('Accounting Software License',          10000,  50000,   16),
        ('Bookkeeping Services',                 8000,   30000,   16),
        ('Website Development',                  20000,  100000,  16),
        ('Digital Marketing Services',           15000,  80000,   16),
        ('Business Advisory Services',           20000,  100000,  16),
    ],
    'NGO': [
        ('Project Implementation Support',       50000,  300000,  0 ),
        ('Monitoring & Evaluation Services',     30000,  200000,  0 ),
        ('Capacity Building Workshop',           20000,  100000,  0 ),
    ],
}

WHT_MAP = {
    'Corporate':  'Contracts',
    'Government': 'Contracts',
    'SME':        'None',
    'NGO':        'None',
    'Individual': 'None',
}


def kenyan_kra_pin():
    letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    return f'P{random.randint(100000000, 999999999)}{random.choice(letters)}'


class Command(BaseCommand):
    help = 'Generate realistic AR customer and invoice data'

    def add_arguments(self, parser):
        parser.add_argument('--customers', type=int, default=20,
                            help='Number of customers to generate (default: 20)')
        parser.add_argument('--invoices', type=int, default=70,
                            help='Number of invoices to generate (default: 70)')
        parser.add_argument('--clear', action='store_true',
                            help='Clear existing AR data before generating')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('  Clearing existing AR data...')
            ReceiptAllocation.objects.all().delete()
            Receipt.objects.all().delete()
            InvoiceLine.objects.all().delete()
            Invoice.objects.all().delete()
            Customer.objects.all().delete()
            self.stdout.write(self.style.WARNING('  Cleared.\n'))

        # Step 1: Create customers
        self.stdout.write(f'Step 1: Creating {options["customers"]} customers...')
        customers = []
        names = random.sample(KENYAN_CUSTOMERS, min(options['customers'], len(KENYAN_CUSTOMERS)))

        for name in names:
            ctype = random.choice(['Corporate', 'Corporate', 'Government', 'SME', 'NGO'])
            credit_limit = random.choice([0, 0, 200000, 500000, 1000000, 2000000])
            discount_pct = random.choice([0, 0, 0, 1, 2, 2.5])

            c = Customer.objects.create(
                name                      = name,
                customer_type             = ctype,
                status                    = 'Active',
                contact_person            = fake.name(),
                email                     = fake.company_email(),
                phone                     = f'07{random.randint(10000000, 99999999)}',
                address                   = fake.street_address(),
                city                      = random.choice(['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru']),
                kra_pin                   = kenyan_kra_pin(),
                vat_number                = f'VAT{random.randint(100000000, 999999999)}',
                wht_category              = WHT_MAP.get(ctype, 'None'),
                credit_limit              = credit_limit,
                payment_terms_days        = random.choice([14, 30, 45, 60]),
                early_payment_discount_pct= discount_pct,
                early_payment_days        = 10 if discount_pct > 0 else 0,
            )
            customers.append(c)
            self.stdout.write(f'    {c.customer_number}  {c.name}  ({ctype})')

        # Step 2: Generate invoices
        self.stdout.write(f'\nStep 2: Generating {options["invoices"]} invoices...')
        today = date(2026, 3, 19)
        invoices_created = 0

        for _ in range(options['invoices']):
            customer  = random.choice(customers)
            ctype     = customer.customer_type
            services  = SERVICES.get(ctype, SERVICES['Corporate'])
            desc, lo, hi, vat_pct = random.choice(services)

            invoice_date = fake.date_between(start_date=date(2025, 9, 1), end_date=today)
            due_date     = invoice_date + timedelta(days=customer.payment_terms_days)
            unit_price   = random.randint(lo // 1000, hi // 1000) * 1000
            quantity     = random.choice([1, 1, 1, 2, 3])

            # Invoice type distribution
            inv_type_weight = random.random()
            if inv_type_weight < 0.70:
                inv_type = 'Invoice'
            elif inv_type_weight < 0.85:
                inv_type = 'Proforma'
            elif inv_type_weight < 0.95:
                inv_type = 'Recurring'
            else:
                inv_type = 'Credit_Note'

            subtotal   = Decimal(str(unit_price * quantity))
            vat_amount = (subtotal * Decimal(str(vat_pct)) / 100).quantize(Decimal('0.01'))
            wht_amount = (subtotal * customer.wht_rate).quantize(Decimal('0.01'))
            total      = subtotal + vat_amount - wht_amount

            # Status distribution
            sw = random.random()
            if sw < 0.10:
                inv_status = 'Draft'
            elif sw < 0.15:
                inv_status = 'Cancelled'
            elif sw < 0.25:
                inv_status = 'Approved'
            elif sw < 0.45:
                inv_status = 'Sent'
            elif sw < 0.55:
                inv_status = 'Partially_Collected'
            else:
                inv_status = 'Collected'

            invoice = Invoice.objects.create(
                customer        = customer,
                invoice_type    = inv_type,
                invoice_date    = invoice_date,
                due_date        = due_date,
                subtotal        = subtotal,
                vat_amount      = vat_amount,
                wht_amount      = wht_amount,
                total_amount    = total,
                status          = inv_status,
                is_recurring    = inv_type == 'Recurring',
                recurrence_interval = 'Monthly' if inv_type == 'Recurring' else '',
                notes           = f'Auto-generated for {desc}',
            )

            InvoiceLine.objects.create(
                invoice    = invoice,
                description= desc,
                quantity   = quantity,
                unit_price = unit_price,
                vat_rate   = vat_pct,
            )

            # Add receipts for collected/partially collected
            if inv_status in ('Partially_Collected', 'Collected'):
                pay_amount = total if inv_status == 'Collected' else (total * Decimal('0.5')).quantize(Decimal('0.01'))
                receipt = Receipt.objects.create(
                    customer       = customer,
                    receipt_date   = due_date - timedelta(days=random.randint(0, 10)),
                    payment_method = random.choice(['Bank Transfer', 'Bank Transfer', 'M-Pesa', 'Cheque']),
                    amount         = pay_amount,
                    wht_deducted   = wht_amount if inv_status == 'Collected' else Decimal('0'),
                    reference      = fake.bothify(text='REC-######'),
                )
                ReceiptAllocation.objects.create(receipt=receipt, invoice=invoice, amount=pay_amount)
                invoice.amount_collected = pay_amount
                if inv_status == 'Collected':
                    invoice.collected_at = timezone.now()
                invoice.save()

            invoices_created += 1
            self.stdout.write(
                f'    {invoice.invoice_number}  {customer.name}  '
                f'KES {total:,}  [{inv_status}]'
            )

        self.stdout.write(self.style.SUCCESS(
            f'\n✓ Done. {len(customers)} customers and {invoices_created} invoices created.'
        ))
        self.stdout.write(
            'Next:\n'
            '  GET  /api/ar/dashboard/\n'
            '  GET  /api/ar/aging/\n'
            '  GET  /api/ar/invoices/\n'
        )