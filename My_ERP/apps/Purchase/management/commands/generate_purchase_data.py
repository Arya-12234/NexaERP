"""
Management command: generate_purchase_data
Usage:
    python manage.py generate_purchase_data
    python manage.py generate_purchase_data --clear
"""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from faker import Faker

from apps.Purchase.models import (
    Supplier, PurchaseRequisition, RequisitionLine,
    PurchaseBudget, GoodsReceivedNote, GRNLine, SupplierRating,
)

fake = Faker('en_GB')

SUPPLIER_DATA = [
    ('Techno Brain Kenya',       'Distributor',   'Electronics & IT'),
    ('Computer Point Nairobi',   'Retailer',      'Electronics & IT'),
    ('Office Mart Kenya',        'Wholesaler',     'Office Supplies'),
    ('Bidco Africa',             'Manufacturer',  'Beverages & Consumables'),
    ('Haco Industries',          'Manufacturer',  'Cleaning & Hygiene'),
    ('Chandaria Industries',     'Manufacturer',  'Packaging Materials'),
    ('Davis & Shirtliff',        'Distributor',   'Spare Parts & Maintenance'),
    ('Toyota Kenya Ltd',         'Manufacturer',  'Motor Vehicles'),
    ('Furniture Palace',         'Retailer',      'Furniture & Fixtures'),
    ('Nakumatt Wholesale',       'Wholesaler',     'General Supplies'),
    ('Carrefour B2B',            'Wholesaler',     'General Supplies'),
    ('Naivas Wholesale',         'Wholesaler',     'Beverages & Consumables'),
    ('Dell Technologies Kenya',  'Manufacturer',  'Electronics & IT'),
    ('HP Kenya',                 'Distributor',   'Electronics & IT'),
    ('Safaricom Business',       'Service',       'Telecommunications'),
]

DEPARTMENTS = ['Finance', 'IT', 'Operations', 'HR', 'Marketing', 'Procurement', 'Admin']

ITEMS = [
    ('Dell Latitude Laptops',      45000, 200000),
    ('Office Chairs',               8000,  20000),
    ('A4 Paper Reams',                450,   2000),
    ('Network Switches',           25000, 100000),
    ('Cleaning Supplies',           1000,  10000),
    ('Printer Toner Cartridges',    3500,  15000),
    ('UPS Systems',                 8000,  30000),
    ('Office Desks',               12000,  40000),
    ('Safety Equipment',            2000,  15000),
    ('Generator Parts',             5000,  50000),
    ('Coffee & Beverages',            500,   5000),
    ('Packaging Materials',           500,   8000),
    ('Fire Extinguishers',           3500,  10000),
    ('CCTV Cameras',               15000,  80000),
    ('Air Conditioner Filters',       600,   3000),
]

BANKS = ['Equity Bank', 'KCB Bank', 'Co-operative Bank',
         'Standard Chartered', 'NCBA Bank', 'Absa Bank']


def kra_pin():
    return f'P{random.randint(100000000, 999999999)}{"ABCDEFGHJKLMNPQRSTUVWXYZ"[random.randint(0, 23)]}'


class Command(BaseCommand):
    help = 'Generate realistic purchase module data'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing purchase data...')
            SupplierRating.objects.all().delete()
            GRNLine.objects.all().delete()
            GoodsReceivedNote.objects.all().delete()
            RequisitionLine.objects.all().delete()
            PurchaseRequisition.objects.all().delete()
            PurchaseBudget.objects.all().delete()
            Supplier.objects.all().delete()
            self.stdout.write('Cleared.\n')

        today = date(2026, 3, 23)

        # Step 1: Suppliers
        self.stdout.write('Step 1: Creating suppliers...')
        suppliers = []
        for name, stype, category in SUPPLIER_DATA:
            s, _ = Supplier.objects.get_or_create(
                name=name,
                defaults={
                    'supplier_type':       stype,
                    'status':              'Active',
                    'contact_person':      fake.name(),
                    'email':               fake.company_email(),
                    'phone':               f'07{random.randint(10000000, 99999999)}',
                    'address':             fake.street_address(),
                    'city':                random.choice(['Nairobi', 'Mombasa', 'Kisumu']),
                    'kra_pin':             kra_pin(),
                    'bank_name':           random.choice(BANKS),
                    'account_number':      str(random.randint(1000000000, 9999999999)),
                    'payment_terms_days':  random.choice([14, 30, 45, 60]),
                    'credit_limit':        random.choice([0, 100000, 500000, 1000000]),
                    'lead_time_days':      random.randint(3, 21),
                    'categories_supplied': category,
                    'total_orders':        random.randint(5, 50),
                    'total_spend':         random.randint(100000, 5000000),
                }
            )
            suppliers.append(s)
            self.stdout.write(f'    {s.supplier_number}  {s.name}')

        # Step 2: Purchase Budgets
        self.stdout.write('\nStep 2: Creating purchase budgets...')
        for dept in DEPARTMENTS:
            for month in range(1, 4):
                budget = random.randint(50, 500) * 1000
                spent  = random.randint(int(budget * 0.3), int(budget * 1.1))
                PurchaseBudget.objects.get_or_create(
                    department=dept, year=2026, month=month, period='Monthly',
                    defaults={'budget_amount': budget, 'spent_amount': min(spent, budget * 2)}
                )
        self.stdout.write(f'    Created budgets for {len(DEPARTMENTS)} departments')

        # Step 3: Purchase Requisitions
        self.stdout.write('\nStep 3: Creating purchase requisitions...')
        for i in range(20):
            dept   = random.choice(DEPARTMENTS)
            pr_date = fake.date_between(start_date=date(2025, 11, 1), end_date=today)
            sw     = random.random()
            if sw < 0.15:   pr_status = 'Draft'
            elif sw < 0.30: pr_status = 'Submitted'
            elif sw < 0.55: pr_status = 'Approved'
            elif sw < 0.65: pr_status = 'Rejected'
            elif sw < 0.85: pr_status = 'Converted'
            else:            pr_status = 'Closed'

            priority = random.choice(['Low', 'Medium', 'Medium', 'High', 'Urgent'])
            supplier = random.choice(suppliers)

            pr = PurchaseRequisition.objects.create(
                title            = f'{random.choice(ITEMS)[0]} — {dept}',
                department       = dept,
                requested_by     = fake.name(),
                priority         = priority,
                status           = pr_status,
                date_required    = pr_date + timedelta(days=random.randint(7, 30)),
                preferred_supplier = supplier,
                justification    = f'Required for {dept} department operations.',
                notes            = f'PR #{i+1}',
            )

            for _ in range(random.randint(1, 4)):
                item, lo, hi = random.choice(ITEMS)
                qty          = random.randint(1, 10)
                price        = random.randint(lo // 1000, hi // 1000) * 1000
                RequisitionLine.objects.create(
                    requisition    = pr,
                    description    = item,
                    quantity       = qty,
                    unit_of_measure= 'Piece',
                    estimated_price= price,
                )
            pr.recalculate_totals()
            self.stdout.write(f'    {pr.pr_number}  {pr.title}  [{pr_status}]')

        # Step 4: GRNs
        self.stdout.write('\nStep 4: Creating Goods Received Notes...')
        try:
            from apps.Inventory.models import Warehouse
            warehouses = list(Warehouse.objects.filter(status='Active'))
        except Exception:
            warehouses = []

        for i in range(15):
            supplier    = random.choice(suppliers)
            recv_date   = fake.date_between(start_date=date(2025, 10, 1), end_date=today)
            grn_status  = random.choice(['Draft', 'Confirmed', 'Posted', 'Posted', 'Posted'])
            wh          = random.choice(warehouses) if warehouses else None

            grn = GoodsReceivedNote.objects.create(
                supplier        = supplier,
                po_reference    = fake.bothify(text='PO-######'),
                warehouse       = wh,
                received_date   = recv_date,
                status          = grn_status,
                delivery_note_no= fake.bothify(text='DN-######'),
                vehicle_number  = fake.bothify(text='KCA ###?').upper(),
                driver_name     = fake.name(),
            )

            total_val = 0
            num_lines = random.randint(1, 5)
            for _ in range(num_lines):
                item, lo, hi = random.choice(ITEMS)
                qty_ord  = random.randint(5, 50)
                qty_recv = qty_ord if random.random() > 0.2 else random.randint(1, qty_ord)
                unit_cost= random.randint(lo // 1000, hi // 1000) * 1000
                condition= random.choice(['Good', 'Good', 'Good', 'Damaged'])
                GRNLine.objects.create(
                    grn=grn, description=item,
                    quantity_ordered=qty_ord, quantity_received=qty_recv,
                    unit_cost=unit_cost, condition=condition,
                )
                total_val += qty_recv * unit_cost

            grn.total_items = num_lines
            grn.total_value = total_val
            grn.save()
            self.stdout.write(f'    {grn.grn_number}  {supplier.name}  KES {total_val:,}  [{grn_status}]')

        # Step 5: Supplier Ratings
        self.stdout.write('\nStep 5: Creating supplier ratings...')
        for supplier in random.sample(suppliers, min(10, len(suppliers))):
            for _ in range(random.randint(2, 5)):
                rating_date = fake.date_between(start_date=date(2025, 10, 1), end_date=today)
                SupplierRating.objects.create(
                    supplier            = supplier,
                    po_reference        = fake.bothify(text='PO-######'),
                    date                = rating_date,
                    quality_rating      = random.randint(2, 5),
                    delivery_rating     = random.randint(2, 5),
                    pricing_rating      = random.randint(2, 5),
                    communication_rating= random.randint(2, 5),
                    on_time_delivery    = random.random() > 0.2,
                    comments            = random.choice([
                        'Good quality products, delivered on time.',
                        'Slight delay but good quality.',
                        'Excellent service and competitive pricing.',
                        'Some items were damaged on arrival.',
                        'Very responsive and professional.',
                    ]),
                )

        self.stdout.write(self.style.SUCCESS(
            f'\n✓ Done. {len(suppliers)} suppliers, 20 PRs, 15 GRNs, budgets created.'
        ))
        self.stdout.write(
            'Next:\n'
            '  GET /api/purchase/dashboard/\n'
            '  GET /api/purchase/suppliers/\n'
            '  GET /api/purchase/requisitions/\n'
            '  GET /api/purchase/grns/\n'
            '  GET /api/purchase/budgets/summary/\n'
        )