"""
Management command: generate_inventory_data

Generates realistic inventory data for a Kenyan SME.

Usage:
    python manage.py generate_inventory_data
    python manage.py generate_inventory_data --products 80 --clear
"""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from faker import Faker

from apps.Inventory.models import (
    Category, Warehouse, Product, WarehouseInventory,
    StockMovement, PurchaseOrder, PurchaseOrderLine,
    StockAdjustment, FIFOLayer,
)

fake = Faker('en_GB')

WAREHOUSES = [
    {'name': 'Main Warehouse — Nairobi',  'code': 'NBI', 'city': 'Nairobi',  'is_default': True},
    {'name': 'Mombasa Branch Store',      'code': 'MSA', 'city': 'Mombasa',  'is_default': False},
    {'name': 'Kisumu Regional Store',     'code': 'KSM', 'city': 'Kisumu',   'is_default': False},
]

CATEGORIES = [
    'Electronics & IT',
    'Office Supplies',
    'Furniture & Fixtures',
    'Cleaning & Hygiene',
    'Beverages & Consumables',
    'Spare Parts & Maintenance',
    'Packaging Materials',
    'Safety Equipment',
    'Professional Services',
    'Software & Licenses',
]

PRODUCTS = {
    'Electronics & IT': [
        ('Dell Latitude Laptop 15"',  'Piece',  45000, 65000,  True,  'WAC'),
        ('HP LaserJet Printer',       'Piece',  18000, 28000,  True,  'WAC'),
        ('Cisco Network Switch 24P',  'Piece',  25000, 40000,  True,  'FIFO'),
        ('UPS 1KVA APC',              'Piece',  8000,  14000,  True,  'WAC'),
        ('USB-C Hub 7-in-1',          'Piece',  1500,  3500,   True,  'WAC'),
        ('HDMI Cable 2M',             'Piece',  300,   800,    True,  'WAC'),
        ('Keyboard & Mouse Combo',    'Piece',  1200,  2800,   True,  'WAC'),
        ('External SSD 1TB',          'Piece',  5000,  8500,   True,  'FIFO'),
    ],
    'Office Supplies': [
        ('A4 Paper Ream 80gsm',       'Box',    450,   700,    True,  'WAC'),
        ('Ballpoint Pens Box',        'Box',    180,   350,    True,  'WAC'),
        ('Stapler Heavy Duty',        'Piece',  350,   800,    True,  'WAC'),
        ('Filing Cabinet 4-Drawer',   'Piece',  8000,  15000,  True,  'FIFO'),
        ('Whiteboard 1.2m x 0.9m',    'Piece',  3500,  6000,   True,  'WAC'),
        ('Sticky Notes Pack',         'Piece',  120,   280,    True,  'WAC'),
        ('Lever Arch Files Box',      'Box',    800,   1400,   True,  'WAC'),
        ('Calculator Scientific',     'Piece',  800,   1800,   True,  'WAC'),
    ],
    'Furniture & Fixtures': [
        ('Executive Office Chair',    'Piece',  8000,  18000,  True,  'FIFO'),
        ('Office Desk 1.6m',          'Piece',  12000, 22000,  True,  'FIFO'),
        ('4-Seater Waiting Bench',    'Piece',  6000,  12000,  True,  'FIFO'),
        ('Steel Locker 6-Door',       'Piece',  9000,  16000,  True,  'FIFO'),
        ('Bookshelf 5-Tier',          'Piece',  4000,  8000,   True,  'WAC'),
    ],
    'Cleaning & Hygiene': [
        ('Liquid Hand Soap 5L',       'Litre',  800,   1400,   True,  'WAC'),
        ('Disinfectant Spray 750ml',  'Piece',  350,   650,    True,  'WAC'),
        ('Tissue Paper Rolls Pack',   'Carton', 1200,  2000,   True,  'WAC'),
        ('Mop & Bucket Set',          'Piece',  1500,  2800,   True,  'WAC'),
        ('Garbage Bags 50pcs',        'Box',    250,   500,    True,  'WAC'),
    ],
    'Beverages & Consumables': [
        ('Coffee Jar 200g Nescafe',   'Piece',  450,   800,    True,  'FIFO'),
        ('Sugar 2Kg Pack',            'Kg',     240,   380,    True,  'FIFO'),
        ('Bottled Water 500ml Crate', 'Carton', 600,   900,    True,  'FIFO'),
        ('Tea Bags 100pcs',           'Box',    280,   500,    True,  'FIFO'),
        ('Creamer 400g',              'Piece',  350,   600,    True,  'FIFO'),
    ],
    'Packaging Materials': [
        ('Cardboard Boxes 40x30x30',  'Piece',  80,    150,    True,  'WAC'),
        ('Bubble Wrap Roll 50M',      'Piece',  1200,  2000,   True,  'WAC'),
        ('Packing Tape 48mm',         'Piece',  120,   220,    True,  'WAC'),
        ('Stretch Film 500mm',        'Piece',  800,   1400,   True,  'WAC'),
    ],
    'Safety Equipment': [
        ('Fire Extinguisher 2Kg CO2', 'Piece',  3500,  6000,   True,  'FIFO'),
        ('First Aid Kit Office',      'Piece',  2500,  4500,   True,  'WAC'),
        ('Safety Gloves Pair',        'Piece',  150,   350,    True,  'WAC'),
        ('Hard Hat Yellow',           'Piece',  400,   800,    True,  'WAC'),
        ('Safety Goggles',            'Piece',  250,   500,    True,  'WAC'),
    ],
    'Professional Services': [
        ('IT Support Contract Monthly', 'Month', 30000, 50000, False, 'WAC'),
        ('Legal Advisory Retainer',     'Month', 50000, 80000, False, 'WAC'),
        ('Cleaning Service Monthly',    'Month', 15000, 25000, False, 'WAC'),
        ('Security Guard Daily Rate',   'Hour',  500,   800,   False, 'WAC'),
    ],
    'Software & Licenses': [
        ('Microsoft 365 Business',    'Month',  1200,  2000,   False, 'WAC'),
        ('Adobe Creative Cloud',      'Month',  3500,  5500,   False, 'WAC'),
        ('Antivirus License Annual',  'Piece',  2000,  4000,   False, 'WAC'),
        ('QuickBooks License',        'Piece',  15000, 25000,  False, 'WAC'),
    ],
    'Spare Parts & Maintenance': [
        ('Generator Fuel Filter',     'Piece',  800,   1500,   True,  'FIFO'),
        ('Air Conditioner Filter',    'Piece',  600,   1200,   True,  'FIFO'),
        ('Printer Toner HP',          'Piece',  3500,  6000,   True,  'FIFO'),
        ('Power Strip 6-Way',         'Piece',  600,   1200,   True,  'WAC'),
        ('Extension Cable 10M',       'Piece',  800,   1500,   True,  'WAC'),
    ],
}

SUPPLIERS = [
    'Techno Brain Kenya', 'Computer Point Nairobi', 'Office Mart Kenya',
    'Bidco Africa', 'Haco Industries', 'Chandaria Industries',
    'Davis & Shirtliff', 'Toyota Kenya Ltd', 'Furniture Palace',
    'Nakumatt Wholesale', 'Carrefour B2B', 'Naivas Wholesale',
]


class Command(BaseCommand):
    help = 'Generate realistic inventory data for a Kenyan SME'

    def add_arguments(self, parser):
        parser.add_argument('--products', type=int, default=60,
                            help='Max products to generate (default: 60)')
        parser.add_argument('--clear', action='store_true',
                            help='Clear existing inventory data before generating')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('  Clearing existing inventory data...')
            FIFOLayer.objects.all().delete()
            StockAdjustment.objects.all().delete()
            StockMovement.objects.all().delete()
            PurchaseOrderLine.objects.all().delete()
            PurchaseOrder.objects.all().delete()
            WarehouseInventory.objects.all().delete()
            Product.objects.all().delete()
            Warehouse.objects.all().delete()
            Category.objects.all().delete()
            self.stdout.write(self.style.WARNING('  Cleared.\n'))

        # Step 1: Warehouses
        self.stdout.write('Step 1: Creating warehouses...')
        warehouses = []
        for wh_data in WAREHOUSES:
            wh, _ = Warehouse.objects.get_or_create(
                code=wh_data['code'],
                defaults={
                    'name':       wh_data['name'],
                    'city':       wh_data['city'],
                    'manager':    fake.name(),
                    'phone':      f'07{random.randint(10000000, 99999999)}',
                    'is_default': wh_data['is_default'],
                    'status':     'Active',
                }
            )
            warehouses.append(wh)
            self.stdout.write(f'    {wh.code}  {wh.name}')

        # Step 2: Categories
        self.stdout.write('\nStep 2: Creating categories...')
        cat_objects = {}
        for cat_name in CATEGORIES:
            cat, _ = Category.objects.get_or_create(name=cat_name)
            cat_objects[cat_name] = cat
            self.stdout.write(f'    {cat.name}')

        # Step 3: Products
        self.stdout.write(f'\nStep 3: Creating products (up to {options["products"]})...')
        products_created = 0
        sku_counter      = 1
        all_products     = []
        today            = date(2026, 3, 19)
        main_wh          = warehouses[0]

        for cat_name, product_list in PRODUCTS.items():
            cat = cat_objects[cat_name]
            for item in product_list:
                if products_created >= options['products']:
                    break

                name, uom, cost_lo, cost_hi, track, val_method = item
                cost_price    = random.randint(cost_lo, cost_hi)
                selling_price = int(cost_price * random.uniform(1.25, 1.8))

                is_service    = not track
                product_type  = 'Service' if is_service else 'Goods'

                sku = f'SKU-{sku_counter:04d}'
                barcode = f'69{random.randint(10000000000, 99999999999)}' if not is_service else None

                p = Product.objects.create(
                    sku              = sku,
                    barcode          = barcode,
                    name             = name,
                    category         = cat,
                    product_type     = product_type,
                    status           = 'Active',
                    unit_of_measure  = uom,
                    valuation_method = val_method,
                    cost_price       = cost_price,
                    selling_price    = selling_price,
                    vat_rate         = 16 if product_type == 'Goods' else 16,
                    track_stock      = track,
                    reorder_point    = random.randint(5, 20) if track else 0,
                    reorder_quantity = random.randint(20, 100) if track else 0,
                    minimum_stock    = random.randint(2, 10) if track else 0,
                    maximum_stock    = random.randint(100, 500) if track else 0,
                    preferred_supplier = random.choice(SUPPLIERS),
                    lead_time_days   = random.randint(3, 21) if track else 0,
                )

                all_products.append(p)
                sku_counter      += 1
                products_created += 1

                # Create stock for goods across warehouses
                if track:
                    for wh in warehouses:
                        qty = random.randint(0, 150)
                        if qty > 0:
                            inv = WarehouseInventory.objects.create(
                                product=p, warehouse=wh, quantity_on_hand=qty
                            )
                            # Create FIFO layers
                            if val_method == 'FIFO':
                                for _ in range(random.randint(1, 3)):
                                    layer_qty = random.randint(10, 50)
                                    receipt_date = today - timedelta(days=random.randint(30, 365))
                                    layer_cost   = cost_price * Decimal(str(random.uniform(0.9, 1.1)))
                                    FIFOLayer.objects.create(
                                        product=p, warehouse=wh,
                                        receipt_date=receipt_date,
                                        quantity_in=layer_qty,
                                        quantity_remaining=min(layer_qty, qty),
                                        unit_cost=layer_cost.quantize(Decimal('1')),
                                        source_ref=fake.bothify(text='PO-######'),
                                    )

                            # Create stock movements history
                            receipt_date = today - timedelta(days=random.randint(30, 180))
                            StockMovement.objects.create(
                                product=p, warehouse=wh,
                                movement_type='Opening',
                                quantity=qty, unit_cost=cost_price,
                                total_cost=Decimal(str(qty)) * Decimal(str(cost_price)),
                                quantity_before=0, quantity_after=qty,
                                date=receipt_date,
                                source_ref='Opening Balance',
                                notes='Initial stock entry',
                            )

                self.stdout.write(f'    {p.sku}  {p.name}  [{product_type}/{val_method}]  Cost: KES {cost_price:,}')

        # Step 4: Purchase Orders
        self.stdout.write('\nStep 4: Creating purchase orders...')
        goods_products = [p for p in all_products if p.product_type == 'Goods']

        for i in range(15):
            selected_products = random.sample(goods_products, min(random.randint(2, 5), len(goods_products)))
            order_date        = fake.date_between(start_date=date(2025, 10, 1), end_date=today)
            status_weight     = random.random()

            if status_weight < 0.15:
                po_status = 'Draft'
            elif status_weight < 0.25:
                po_status = 'Approved'
            elif status_weight < 0.40:
                po_status = 'Partial'
            elif status_weight < 0.85:
                po_status = 'Received'
            else:
                po_status = 'Cancelled'

            wh = random.choice(warehouses)
            po = PurchaseOrder.objects.create(
                supplier      = random.choice(SUPPLIERS),
                supplier_ref  = fake.bothify(text='SU-######'),
                warehouse     = wh,
                order_date    = order_date,
                expected_date = order_date + timedelta(days=random.randint(7, 30)),
                status        = po_status,
                notes         = f'Auto-generated PO #{i+1}',
            )

            for product in selected_products:
                qty       = random.randint(10, 100)
                unit_cost = product.cost_price * Decimal(str(random.uniform(0.85, 1.05)))
                received  = qty if po_status == 'Received' else (
                    random.randint(1, qty - 1) if po_status == 'Partial' else 0
                )
                PurchaseOrderLine.objects.create(
                    po=po, product=product,
                    quantity_ordered=qty,
                    quantity_received=received,
                    unit_cost=unit_cost.quantize(Decimal('1')),
                    vat_rate=16,
                )

            po.recalculate_totals()
            self.stdout.write(f'    {po.po_number}  {po.supplier}  KES {po.total_amount:,}  [{po_status}]')

        # Step 5: Stock adjustments
        self.stdout.write('\nStep 5: Creating stock adjustments...')
        for _ in range(10):
            p   = random.choice(goods_products)
            wh  = random.choice(warehouses)
            inv = WarehouseInventory.objects.filter(product=p, warehouse=wh).first()
            if not inv or inv.quantity_on_hand <= 0:
                continue
            qty_before = inv.quantity_on_hand
            adj_amount = random.randint(1, min(5, int(qty_before)))
            qty_after  = qty_before - adj_amount
            adj_date   = fake.date_between(start_date=date(2025, 12, 1), end_date=today)
            reason     = random.choice(['Damage', 'Expiry', 'Theft', 'Count_Variance'])

            StockAdjustment.objects.create(
                product=p, warehouse=wh,
                reason=reason,
                quantity_before=qty_before,
                quantity_after=qty_after,
                adjustment_qty=-adj_amount,
                unit_cost=p.cost_price,
                total_cost=adj_amount * p.cost_price,
                date=adj_date,
                notes=f'Auto-generated {reason} adjustment',
            )
            inv.quantity_on_hand = qty_after
            inv.save()
            self.stdout.write(f'    {p.sku}  {reason}  -{adj_amount} units @ {wh.code}')

        self.stdout.write(self.style.SUCCESS(
            f'\n✓ Done. {products_created} products, {len(warehouses)} warehouses, '
            f'15 POs and 10 adjustments created.'
        ))
        self.stdout.write(
            'Next:\n'
            '  GET  /api/inventory/dashboard/\n'
            '  GET  /api/inventory/products/\n'
            '  GET  /api/inventory/reorder-alerts/\n'
            '  GET  /api/inventory/valuation/\n'
        )