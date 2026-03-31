"""
Management command: generate_assets_data

Generates realistic fixed asset data for a Kenyan SME using Faker.

Usage:
    python manage.py generate_assets_data
    python manage.py generate_assets_data --assets 50
    python manage.py generate_assets_data --clear
"""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from faker import Faker

from apps.Assets.models import AssetCategory, Asset, MaintenanceLog

fake = Faker('en_GB')

# Realistic asset categories for a Kenyan SME with depreciation config
CATEGORIES = [
    {
        'name':                       'Computers & IT Equipment',
        'depreciation_method':        'DBM',
        'default_useful_life_months': 36,
        'default_depreciation_rate':  Decimal('0.3333'),  # 33.33% DBM
        'description':                'Laptops, desktops, servers, networking equipment',
    },
    {
        'name':                       'Motor Vehicles',
        'depreciation_method':        'DBM',
        'default_useful_life_months': 60,
        'default_depreciation_rate':  Decimal('0.25'),    # 25% DBM
        'description':                'Company cars, vans, motorcycles',
    },
    {
        'name':                       'Office Furniture & Fittings',
        'depreciation_method':        'SLM',
        'default_useful_life_months': 120,
        'default_depreciation_rate':  Decimal('0'),
        'description':                'Desks, chairs, cabinets, partitions',
    },
    {
        'name':                       'Machinery & Equipment',
        'depreciation_method':        'SLM',
        'default_useful_life_months': 84,
        'default_depreciation_rate':  Decimal('0'),
        'description':                'Production machinery, generators, industrial equipment',
    },
    {
        'name':                       'Buildings & Improvements',
        'depreciation_method':        'SLM',
        'default_useful_life_months': 480,  # 40 years
        'default_depreciation_rate':  Decimal('0'),
        'description':                'Leasehold improvements, office fit-outs',
    },
    {
        'name':                       'Communication Equipment',
        'depreciation_method':        'DBM',
        'default_useful_life_months': 36,
        'default_depreciation_rate':  Decimal('0.3333'),
        'description':                'PABX systems, phones, radios',
    },
]

# Realistic assets per category
ASSETS_PER_CATEGORY = {
    'Computers & IT Equipment': [
        ('Dell Latitude Laptop',       80000,  220000,  5000),
        ('HP ProBook Laptop',          75000,  180000,  4000),
        ('Apple MacBook Pro',          120000, 280000,  8000),
        ('Dell PowerEdge Server',      200000, 600000,  15000),
        ('Cisco Network Switch',       50000,  150000,  3000),
        ('HP LaserJet Printer',        25000,  80000,   2000),
        ('Samsung Monitor 27"',        15000,  45000,   1000),
        ('Synology NAS Storage',       80000,  200000,  5000),
    ],
    'Motor Vehicles': [
        ('Toyota Hilux Pickup',        1200000, 2800000, 50000),
        ('Toyota Land Cruiser',        3000000, 7000000, 80000),
        ('Isuzu NPR Truck',            2000000, 4500000, 60000),
        ('Toyota Probox',              600000,  1200000, 30000),
        ('Suzuki Alto',                500000,  900000,  20000),
        ('Honda CB125 Motorcycle',     120000,  250000,  8000),
    ],
    'Office Furniture & Fittings': [
        ('Executive Office Desk',      15000,  45000,   500),
        ('Ergonomic Office Chair',     8000,   25000,   300),
        ('4-Door Steel Cabinet',       12000,  35000,   200),
        ('Office Partition System',    50000,  150000,  2000),
        ('Reception Counter',          80000,  200000,  1000),
        ('Boardroom Table 12-seater',  120000, 350000,  2000),
    ],
    'Machinery & Equipment': [
        ('Industrial Generator 50KVA', 500000, 1200000, 20000),
        ('Air Conditioning Unit 3HP',  80000,  200000,  5000),
        ('CCTV System 16-Channel',     60000,  180000,  3000),
        ('Photocopier Ricoh MP3054',   150000, 400000,  8000),
        ('Water Purification System',  40000,  120000,  3000),
        ('Forklift 3-Ton',             800000, 2000000, 30000),
    ],
    'Buildings & Improvements': [
        ('Office Fit-Out Floor 3',     800000, 3000000, 0),
        ('Warehouse Improvements',     500000, 2000000, 0),
        ('Reception Area Renovation',  200000, 800000,  0),
    ],
    'Communication Equipment': [
        ('PABX Phone System',          80000,  250000,  3000),
        ('Video Conferencing System',  150000, 450000,  5000),
        ('UHF Radio Set (10 units)',    50000,  180000,  2000),
    ],
}

SUPPLIERS = [
    'Techno Brain Kenya', 'Computer Point Nairobi', 'Toyota Kenya',
    'CMC Motors', 'Office Mart Kenya', 'Furniture Palace',
    'Kenwest Cables', 'Chloride Exide', 'Davis & Shirtliff',
    'IBM East Africa', 'Dell Technologies Kenya',
]

LOCATIONS = [
    'Head Office - Nairobi', 'Warehouse - Industrial Area',
    'Branch - Mombasa', 'Branch - Kisumu', 'Branch - Nakuru',
    'IT Department', 'Finance Department', 'Operations',
]


class Command(BaseCommand):
    help = 'Generate realistic fixed asset data using Faker'

    def add_arguments(self, parser):
        parser.add_argument('--assets', type=int, default=30,
                            help='Number of assets to generate (default: 30)')
        parser.add_argument('--clear', action='store_true',
                            help='Clear existing asset data before generating')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('  Clearing existing asset data...')
            Asset.objects.all().delete()
            AssetCategory.objects.all().delete()
            self.stdout.write(self.style.WARNING('  Existing data cleared.\n'))

        # Step 1: Create categories
        self.stdout.write('Step 1: Creating asset categories...')
        cat_objects = {}
        for cat_data in CATEGORIES:
            cat, _ = AssetCategory.objects.get_or_create(
                name=cat_data['name'],
                defaults={
                    'description':               cat_data['description'],
                    'depreciation_method':       cat_data['depreciation_method'],
                    'default_useful_life_months':cat_data['default_useful_life_months'],
                    'default_depreciation_rate': cat_data['default_depreciation_rate'],
                }
            )
            cat_objects[cat_data['name']] = cat
            self.stdout.write(f'    {cat.name} ({cat.depreciation_method})')

        # Step 2: Generate assets
        self.stdout.write(f'\nStep 2: Generating {options["assets"]} assets...')
        created = 0
        target  = options['assets']

        while created < target:
            cat_name  = random.choice(list(ASSETS_PER_CATEGORY.keys()))
            cat       = cat_objects[cat_name]
            templates = ASSETS_PER_CATEGORY[cat_name]
            template  = random.choice(templates)

            asset_name, cost_low, cost_high, salvage_base = template
            cost    = random.randint(cost_low // 1000, cost_high // 1000) * 1000
            salvage = max(0, salvage_base + random.randint(-1000, 2000))

            # Random purchase date in last 5 years
            purchase_date = fake.date_between(
                start_date=date(2020, 1, 1),
                end_date=date(2025, 6, 30),
            )
            in_service_date = purchase_date + timedelta(days=random.randint(0, 30))

            # Calculate accumulated depreciation based on months in service
            months_in_service = max(0, (date(2026, 3, 1) - in_service_date).days // 30)

            useful_life   = cat.default_useful_life_months
            depr_method   = cat.depreciation_method
            depr_rate     = cat.default_depreciation_rate

            # Calculate realistic accumulated depreciation
            if depr_method == 'SLM' and useful_life > 0:
                monthly_depr = (cost - salvage) / useful_life
                accum_depr   = min(monthly_depr * months_in_service, cost - salvage)
            elif depr_method == 'DBM' and depr_rate > 0:
                book_val = cost
                accum    = Decimal('0')
                for _ in range(months_in_service):
                    charge = book_val * depr_rate / 12
                    charge = min(charge, book_val - salvage)
                    if charge <= 0:
                        break
                    accum    += charge
                    book_val -= charge
                accum_depr = float(accum)
            else:
                accum_depr = 0

            asset = Asset.objects.create(
                name                    = asset_name,
                category                = cat,
                serial_number           = fake.bothify(text='??-######').upper(),
                brand                   = asset_name.split()[0],
                location                = random.choice(LOCATIONS),
                assigned_to             = fake.job(),
                condition               = random.choice(['Excellent', 'Good', 'Good', 'Fair']),
                status                  = 'Active',
                cost                    = cost,
                salvage_value           = salvage,
                purchase_date           = purchase_date,
                in_service_date         = in_service_date,
                depreciation_method     = depr_method,
                useful_life_months      = useful_life,
                depreciation_rate       = depr_rate,
                accumulated_depreciation= round(accum_depr, 2),
                last_depreciation_date  = date(2026, 3, 1) if months_in_service > 0 else None,
                supplier                = random.choice(SUPPLIERS),
                purchase_order          = fake.bothify(text='PO-######'),
                warranty_expiry         = purchase_date + timedelta(days=365 * random.randint(1, 3)),
            )

            # Add 0-2 maintenance logs
            num_maint = random.randint(0, 2)
            for _ in range(num_maint):
                maint_date = fake.date_between(start_date=in_service_date, end_date=date(2026, 3, 1))
                MaintenanceLog.objects.create(
                    asset            = asset,
                    maintenance_type = random.choice(['Preventive', 'Corrective', 'Inspection']),
                    date             = maint_date,
                    description      = f'{random.choice(["Routine service", "Repair", "Inspection", "Parts replacement"])} — {asset.name}',
                    cost             = random.randint(1, 20) * 1000,
                    vendor           = random.choice(SUPPLIERS),
                    performed_by     = fake.name(),
                )

            created += 1
            self.stdout.write(
                f'    {asset.asset_number}  {asset.name}  |  {depr_method}  |  '
                f'KES {cost:,}  |  Book: KES {int(asset.book_value):,}'
            )

        self.stdout.write(self.style.SUCCESS(
            f'\n✓ Done. {created} assets created across {len(CATEGORIES)} categories.'
        ))
        self.stdout.write(
            'Next:\n'
            '  GET  /api/assets/summary/\n'
            '  POST /api/assets/<id>/depreciate/\n'
            '  POST /api/assets/depreciate-all/\n'
        )