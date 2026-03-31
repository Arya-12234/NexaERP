"""
Management command: generate_payroll_data

Generates realistic Kenyan employee data using Faker.

Usage:
    python manage.py generate_payroll_data
    python manage.py generate_payroll_data --employees 50
    python manage.py generate_payroll_data --clear
"""

import random
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from faker import Faker

from apps.Payroll.models import Department, Employee

fake = Faker('en_GB')

# Realistic Kenyan departments for an SME
DEPARTMENTS = [
    'Finance & Accounts',
    'Human Resources',
    'Sales & Marketing',
    'Information Technology',
    'Operations',
    'Procurement',
    'Customer Service',
    'Legal & Compliance',
]

# Realistic job titles per department
JOB_TITLES = {
    'Finance & Accounts':    ['Accountant', 'Finance Manager', 'Accounts Clerk', 'CFO', 'Auditor'],
    'Human Resources':       ['HR Officer', 'HR Manager', 'Recruitment Specialist', 'Payroll Officer'],
    'Sales & Marketing':     ['Sales Executive', 'Marketing Manager', 'Brand Officer', 'Sales Manager'],
    'Information Technology':['Software Developer', 'IT Support', 'Systems Administrator', 'CTO', 'DevOps Engineer'],
    'Operations':            ['Operations Manager', 'Logistics Officer', 'Warehouse Supervisor', 'Driver'],
    'Procurement':           ['Procurement Officer', 'Supply Chain Manager', 'Buyer'],
    'Customer Service':      ['Customer Service Rep', 'Call Centre Agent', 'Support Lead'],
    'Legal & Compliance':    ['Legal Officer', 'Compliance Manager', 'Company Secretary'],
}

# Salary ranges per job title (KES monthly gross)
SALARY_RANGES = {
    'CFO':                    (350000, 600000),
    'CTO':                    (300000, 500000),
    'Finance Manager':        (150000, 250000),
    'HR Manager':             (120000, 200000),
    'Sales Manager':          (130000, 220000),
    'Marketing Manager':      (120000, 200000),
    'Operations Manager':     (120000, 200000),
    'Supply Chain Manager':   (110000, 180000),
    'Compliance Manager':     (110000, 180000),
    'Software Developer':     (100000, 200000),
    'DevOps Engineer':        (120000, 220000),
    'Systems Administrator':  (80000,  140000),
    'Accountant':             (70000,  120000),
    'Auditor':                (80000,  130000),
    'HR Officer':             (60000,  100000),
    'Payroll Officer':        (60000,  100000),
    'Procurement Officer':    (60000,  100000),
    'Legal Officer':          (80000,  150000),
    'Company Secretary':      (90000,  160000),
    'Sales Executive':        (50000,  90000),
    'Brand Officer':          (55000,  90000),
    'Recruitment Specialist': (55000,  90000),
    'Logistics Officer':      (50000,  80000),
    'Warehouse Supervisor':   (45000,  75000),
    'Customer Service Rep':   (35000,  60000),
    'Call Centre Agent':      (30000,  55000),
    'Support Lead':           (50000,  80000),
    'IT Support':             (45000,  75000),
    'Accounts Clerk':         (35000,  60000),
    'Buyer':                  (50000,  80000),
    'Driver':                 (25000,  40000),
}

DEFAULT_SALARY_RANGE = (30000, 80000)

KENYAN_FIRST_NAMES = [
    'Wanjiku', 'Kamau', 'Otieno', 'Akinyi', 'Muthoni', 'Kipchoge',
    'Zawadi', 'Baraka', 'Amina', 'Hassan', 'Fatuma', 'Juma',
    'Njeri', 'Mwangi', 'Ochieng', 'Adhiambo', 'Chebet', 'Rotich',
    'Wambui', 'Kariuki', 'Omondi', 'Nafula', 'Simiyu', 'Nekesa',
    'Mutua', 'Nduta', 'Onyango', 'Auma', 'Gitau', 'Wachira',
]

KENYAN_LAST_NAMES = [
    'Kamau', 'Otieno', 'Mwangi', 'Odhiambo', 'Kariuki', 'Mutua',
    'Njoroge', 'Omondi', 'Gitau', 'Waweru', 'Kiptoo', 'Rotich',
    'Abubakar', 'Hassan', 'Mohammed', 'Ndegwa', 'Kiprotich', 'Cheruiyot',
    'Owino', 'Onyango', 'Auma', 'Adhiambo', 'Simiyu', 'Wafula',
    'Mugo', 'Njenga', 'Kabiru', 'Ngugi', 'Kimani', 'Mbugua',
]

BANKS = [
    'Equity Bank', 'KCB Bank', 'Co-operative Bank', 'Standard Chartered',
    'NCBA Bank', 'Absa Bank', 'DTB Bank', 'Family Bank', 'I&M Bank',
]


def kenyan_phone():
    prefixes = ['0700', '0710', '0720', '0722', '0733', '0740', '0741', '0750', '0790']
    return f'{random.choice(prefixes)}{random.randint(100000, 999999)}'


def kenyan_national_id():
    return str(random.randint(10000000, 39999999))


def kenyan_kra_pin():
    letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    return f'A{random.randint(100000000, 999999999)}{random.choice(letters)}'


def kenyan_nssf():
    return f'{random.randint(1000000, 9999999)}'


class Command(BaseCommand):
    help = 'Generate realistic Kenyan employee data using Faker'

    def add_arguments(self, parser):
        parser.add_argument('--employees', type=int, default=30,
                            help='Number of employees to generate (default: 30)')
        parser.add_argument('--clear', action='store_true',
                            help='Clear existing payroll data before generating')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('  Clearing existing payroll data...')
            Employee.objects.all().delete()
            Department.objects.all().delete()
            self.stdout.write(self.style.WARNING('  Existing data cleared.\n'))

        # Step 1: Create departments
        self.stdout.write('Step 1: Creating departments...')
        dept_objects = {}
        for dept_name in DEPARTMENTS:
            dept, _ = Department.objects.get_or_create(name=dept_name)
            dept_objects[dept_name] = dept
            self.stdout.write(f'    {dept_name}')

        # Step 2: Generate employees
        self.stdout.write(f'\nStep 2: Generating {options["employees"]} employees...')
        created = 0
        used_ids    = set()
        used_emails = set()

        for _ in range(options['employees']):
            dept_name  = random.choice(DEPARTMENTS)
            dept       = dept_objects[dept_name]
            job_title  = random.choice(JOB_TITLES[dept_name])
            salary_range = SALARY_RANGES.get(job_title, DEFAULT_SALARY_RANGE)
            basic      = random.randint(salary_range[0] // 1000, salary_range[1] // 1000) * 1000

            # Allowances as % of basic
            house_pct     = random.choice([0, 0.10, 0.15, 0.20])
            transport_pct = random.choice([0, 0.05, 0.10])
            other_pct     = random.choice([0, 0.02, 0.05])

            first = random.choice(KENYAN_FIRST_NAMES)
            last  = random.choice(KENYAN_LAST_NAMES)

            # Ensure unique email
            email_base = f'{first.lower()}.{last.lower()}'
            email      = f'{email_base}@{fake.domain_name()}'
            counter    = 1
            while email in used_emails:
                email = f'{email_base}{counter}@{fake.domain_name()}'
                counter += 1
            used_emails.add(email)

            # Ensure unique national ID
            nid = kenyan_national_id()
            while nid in used_ids:
                nid = kenyan_national_id()
            used_ids.add(nid)

            payment_method = random.choice(['Bank Transfer', 'M-Pesa', 'Bank Transfer', 'Bank Transfer'])
            bank = random.choice(BANKS)

            date_joined = fake.date_between(
                start_date=date(2018, 1, 1),
                end_date=date(2024, 12, 31),
            )

            emp = Employee.objects.create(
                first_name          = first,
                last_name           = last,
                email               = email,
                phone               = kenyan_phone(),
                national_id         = nid,
                kra_pin             = kenyan_kra_pin(),
                nssf_number         = kenyan_nssf(),
                shif_number         = kenyan_nssf(),
                department          = dept,
                job_title           = job_title,
                employment_type     = random.choice(['Full-Time', 'Full-Time', 'Full-Time', 'Contract', 'Part-Time']),
                status              = 'Active',
                date_joined         = date_joined,
                basic_salary        = basic,
                house_allowance     = int(basic * house_pct),
                transport_allowance = int(basic * transport_pct),
                other_allowances    = int(basic * other_pct),
                insurance_premium   = random.choice([0, 0, 2000, 3000, 5000]),
                payment_method      = payment_method,
                bank_name           = bank if payment_method == 'Bank Transfer' else '',
                bank_branch         = fake.city() if payment_method == 'Bank Transfer' else '',
                account_number      = str(random.randint(1000000000, 9999999999)) if payment_method == 'Bank Transfer' else '',
                mpesa_number        = kenyan_phone() if payment_method == 'M-Pesa' else '',
            )
            created += 1
            self.stdout.write(f'    {emp.employee_number}  {emp.full_name}  |  {job_title}  |  KES {basic:,}')

        self.stdout.write(self.style.SUCCESS(
            f'\n✓ Done. {created} employees created across {len(DEPARTMENTS)} departments.'
        ))
        self.stdout.write(
            'Next: POST to /api/payroll/runs/ to create a run, '
            'then POST to /api/payroll/runs/<id>/process/ to calculate payslips.'
        )