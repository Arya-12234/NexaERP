"""
Management command: generate_orders_data
Usage:
    python manage.py generate_orders_data
    python manage.py generate_orders_data --clear
"""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from faker import Faker

from apps.Orders.models import (
    Quotation, QuotationLine,
    SalesOrder, SalesOrderLine,
    PurchaseOrder, PurchaseOrderLine,
    Delivery,
)

fake = Faker('en_GB')

CUSTOMERS = [
    'Safaricom PLC', 'Kenya Commercial Bank', 'Equity Group Holdings',
    'East African Breweries', 'Nation Media Group', 'Kenya Airways',
    'Nairobi Hospital', 'Strathmore University', 'Kenya Power',
    'Telkom Kenya', 'G4S Kenya', 'Bidco Africa',
    'MP Shah Hospital', 'KCB Bank', 'Jubilee Insurance',
]

SUPPLIERS = [
    'Techno Brain Kenya', 'Computer Point Nairobi', 'Office Mart Kenya',
    'Bidco Africa', 'Haco Industries', 'Davis & Shirtliff',
    'Toyota Kenya Ltd', 'Furniture Palace', 'Naivas Wholesale',
    'Carrefour B2B', 'Chandaria Industries',
]

SERVICES = [
    ('IT Support Services',        30000,  150000, 16),
    ('Software Development',       80000,  500000, 16),
    ('Consulting Services',        50000,  300000, 16),
    ('Training & Development',     20000,  100000, 16),
    ('Maintenance Contract',       15000,   80000, 16),
    ('Security Services',          25000,  120000, 16),
    ('Office Supplies',             5000,   30000, 16),
    ('Equipment Purchase',         50000,  400000, 16),
    ('Spare Parts',                10000,   80000, 16),
    ('Cleaning Services',           8000,   40000,  0),
]

CARRIERS = ['DHL Kenya', 'Wells Fargo Courier', 'Fargo Courier',
            'G4S Logistics', 'Sendy Kenya', 'Own Vehicle']


class Command(BaseCommand):
    help = 'Generate realistic orders data'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing orders data...')
            Delivery.objects.all().delete()
            SalesOrderLine.objects.all().delete()
            SalesOrder.objects.all().delete()
            QuotationLine.objects.all().delete()
            Quotation.objects.all().delete()
            PurchaseOrderLine.objects.all().delete()
            PurchaseOrder.objects.all().delete()
            self.stdout.write(self.style.WARNING('Cleared.\n'))

        today = date(2026, 3, 23)

        # Step 1: Quotations
        self.stdout.write('Step 1: Creating quotations...')
        for i in range(15):
            customer     = random.choice(CUSTOMERS)
            qt_date      = fake.date_between(start_date=date(2025, 10, 1), end_date=today)
            valid_until  = qt_date + timedelta(days=random.randint(14, 60))
            status_w     = random.random()
            if status_w < 0.2:   qt_status = 'Draft'
            elif status_w < 0.4: qt_status = 'Sent'
            elif status_w < 0.6: qt_status = 'Accepted'
            elif status_w < 0.8: qt_status = 'Rejected'
            else:                qt_status = 'Expired'

            qt = Quotation.objects.create(
                customer=customer,
                customer_email=fake.company_email(),
                customer_phone=f'07{random.randint(10000000, 99999999)}',
                date=qt_date, valid_until=valid_until,
                status=qt_status,
                notes=f'Quotation for {random.choice(SERVICES)[0]}',
                terms='Payment within 30 days of invoice.',
            )
            num_lines = random.randint(1, 4)
            for _ in range(num_lines):
                desc, lo, hi, vat = random.choice(SERVICES)
                qty   = random.randint(1, 5)
                price = random.randint(lo // 1000, hi // 1000) * 1000
                QuotationLine.objects.create(
                    quotation=qt, description=desc,
                    quantity=qty, unit_price=price, vat_rate=vat,
                )
            qt.recalculate_totals()
            self.stdout.write(f'    {qt.quotation_number}  {customer}  KES {qt.total_amount:,}  [{qt_status}]')

        # Step 2: Sales Orders
        self.stdout.write('\nStep 2: Creating sales orders...')
        warehouses = []
        try:
            from apps.Inventory.models import Warehouse
            warehouses = list(Warehouse.objects.filter(status='Active'))
        except Exception:
            pass

        for i in range(20):
            customer   = random.choice(CUSTOMERS)
            order_date = fake.date_between(start_date=date(2025, 10, 1), end_date=today)
            req_date   = order_date + timedelta(days=random.randint(7, 30))
            status_w   = random.random()
            if status_w < 0.10:   so_status = 'Pending'
            elif status_w < 0.20: so_status = 'Confirmed'
            elif status_w < 0.30: so_status = 'Approved'
            elif status_w < 0.45: so_status = 'Processing'
            elif status_w < 0.60: so_status = 'Shipped'
            elif status_w < 0.85: so_status = 'Delivered'
            else:                  so_status = 'Cancelled'

            pay_status = 'Unpaid'
            if so_status in ('Delivered',):
                pay_status = random.choice(['Paid', 'Partially_Paid', 'Unpaid'])

            wh = random.choice(warehouses) if warehouses else None

            so = SalesOrder.objects.create(
                customer=customer,
                customer_email=fake.company_email(),
                customer_phone=f'07{random.randint(10000000, 99999999)}',
                customer_address=fake.address(),
                order_date=order_date,
                requested_date=req_date,
                status=so_status,
                payment_status=pay_status,
                warehouse=wh,
                notes=f'Sales order #{i+1}',
            )
            num_lines = random.randint(1, 5)
            for _ in range(num_lines):
                desc, lo, hi, vat = random.choice(SERVICES)
                qty   = random.randint(1, 10)
                price = random.randint(lo // 1000, hi // 1000) * 1000
                qty_delivered = qty if so_status == 'Delivered' else 0
                SalesOrderLine.objects.create(
                    order=so, description=desc,
                    quantity=qty, unit_price=price, vat_rate=vat,
                    quantity_delivered=qty_delivered,
                )
            so.recalculate_totals()

            # Create delivery for shipped/delivered orders
            if so_status in ('Shipped', 'Delivered'):
                del_status = 'Delivered' if so_status == 'Delivered' else 'Dispatched'
                Delivery.objects.create(
                    sales_order=so,
                    status=del_status,
                    delivery_address=fake.address(),
                    carrier=random.choice(CARRIERS),
                    tracking_number=fake.bothify(text='TRK-########'),
                    driver_name=fake.name(),
                    driver_phone=f'07{random.randint(10000000, 99999999)}',
                    scheduled_date=req_date,
                )

            self.stdout.write(f'    {so.order_number}  {customer}  KES {so.total_amount:,}  [{so_status}]')

        # Step 3: Purchase Orders
        self.stdout.write('\nStep 3: Creating purchase orders...')
        for i in range(15):
            supplier   = random.choice(SUPPLIERS)
            order_date = fake.date_between(start_date=date(2025, 10, 1), end_date=today)
            exp_date   = order_date + timedelta(days=random.randint(7, 30))
            status_w   = random.random()
            if status_w < 0.15:   po_status = 'Draft'
            elif status_w < 0.25: po_status = 'Submitted'
            elif status_w < 0.35: po_status = 'Approved'
            elif status_w < 0.50: po_status = 'Sent'
            elif status_w < 0.65: po_status = 'Partial'
            elif status_w < 0.85: po_status = 'Received'
            else:                  po_status = 'Cancelled'

            wh = random.choice(warehouses) if warehouses else None

            po = PurchaseOrder.objects.create(
                supplier=supplier,
                supplier_email=fake.company_email(),
                supplier_phone=f'07{random.randint(10000000, 99999999)}',
                supplier_ref=fake.bothify(text='SU-######'),
                warehouse=wh,
                order_date=order_date,
                expected_date=exp_date,
                status=po_status,
                notes=f'Purchase order #{i+1}',
                terms='Payment 30 days from delivery.',
            )
            num_lines = random.randint(1, 5)
            for _ in range(num_lines):
                desc, lo, hi, vat = random.choice(SERVICES)
                qty      = random.randint(1, 20)
                cost     = random.randint(lo // 1000, hi // 1000) * 1000
                qty_recv = qty if po_status == 'Received' else (
                    random.randint(1, qty - 1) if po_status == 'Partial' else 0
                )
                PurchaseOrderLine.objects.create(
                    order=po, description=desc,
                    quantity=qty, unit_cost=cost, vat_rate=vat,
                    quantity_received=qty_recv,
                )
            po.recalculate_totals()
            self.stdout.write(f'    {po.order_number}  {supplier}  KES {po.total_amount:,}  [{po_status}]')

        self.stdout.write(self.style.SUCCESS(
            '\n✓ Done. 15 quotations, 20 sales orders, 15 purchase orders created.'
        ))
        self.stdout.write(
            'Next:\n'
            '  GET /api/orders/dashboard/\n'
            '  GET /api/orders/sales/\n'
            '  GET /api/orders/purchases/\n'
            '  GET /api/orders/quotations/\n'
            '  GET /api/orders/deliveries/\n'
        )