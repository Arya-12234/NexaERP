"""
tax_engine.py — Kenyan Statutory Deductions Calculator
=======================================================
Implements the following as per KRA / statutory guidelines:

1. PAYE     — KRA graduated tax bands (2024)
2. NSSF     — New rates under NSSF Act 2013 (Tier I + Tier II, 2024)
3. SHIF     — Social Health Insurance Fund (replaced NHIF, 2024) — 2.75% of gross
4. Housing  — Affordable Housing Levy — 1.5% of gross (employee portion)

All amounts are in KES.
"""

from decimal import Decimal, ROUND_HALF_UP


def kes(value):
    """Round to 2 decimal places."""
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


# ── NSSF 2024 (NSSF Act 2013) ────────────────────────────────
# Tier I : 6% of Lower Earnings Limit (LEL = KES 7,000) → max KES 420
# Tier II: 6% of earnings between LEL and Upper Earnings Limit (UEL = KES 36,000)
#           → max KES 1,740
# Employee and employer each contribute equally.

NSSF_LEL = Decimal('7000')
NSSF_UEL = Decimal('36000')
NSSF_RATE = Decimal('0.06')


def calculate_nssf(gross):
    gross = kes(gross)
    tier1 = kes(min(gross, NSSF_LEL) * NSSF_RATE)
    tier2_base = max(Decimal('0'), min(gross, NSSF_UEL) - NSSF_LEL)
    tier2 = kes(tier2_base * NSSF_RATE)
    total = tier1 + tier2
    return {
        'tier1':  tier1,
        'tier2':  tier2,
        'total':  total,
    }


# ── SHIF 2024 (Social Health Insurance Fund) ─────────────────
# Replaced NHIF effective Oct 2024
# Rate: 2.75% of gross salary, no ceiling
SHIF_RATE = Decimal('0.0275')


def calculate_shif(gross):
    return kes(Decimal(str(gross)) * SHIF_RATE)


# ── Affordable Housing Levy ───────────────────────────────────
# Employee: 1.5% of gross
# Employer: 1.5% of gross (we track both)
HOUSING_LEVY_RATE = Decimal('0.015')


def calculate_housing_levy(gross):
    employee = kes(Decimal(str(gross)) * HOUSING_LEVY_RATE)
    employer = kes(Decimal(str(gross)) * HOUSING_LEVY_RATE)
    return {
        'employee': employee,
        'employer': employer,
    }


# ── PAYE 2024 KRA Tax Bands ───────────────────────────────────
# Monthly taxable income bands and rates (KES):
# 0        – 24,000    : 10%
# 24,001   – 32,333    : 25%
# 32,334   – 500,000   : 30%
# 500,001  – 800,000   : 32.5%
# 800,001+             : 35%
#
# Personal Relief: KES 2,400/month
# Insurance Relief: 15% of premiums paid (if applicable, passed as parameter)

PAYE_BANDS = [
    (Decimal('24000'),  Decimal('0.10')),
    (Decimal('8333'),   Decimal('0.25')),   # 32,333 - 24,000
    (Decimal('467667'), Decimal('0.30')),   # 500,000 - 32,333
    (Decimal('300000'), Decimal('0.325')),  # 800,000 - 500,000
    (None,              Decimal('0.35')),   # 800,001+
]

PERSONAL_RELIEF   = Decimal('2400')
INSURANCE_RELIEF_RATE = Decimal('0.15')


def calculate_paye(gross, nssf_total, insurance_premium=Decimal('0')):
    """
    Calculate PAYE on taxable income.
    Taxable income = Gross - NSSF employee contribution
    """
    gross          = Decimal(str(gross))
    nssf_total     = Decimal(str(nssf_total))
    taxable_income = max(Decimal('0'), gross - nssf_total)

    tax = Decimal('0')
    remaining = taxable_income

    for band_size, rate in PAYE_BANDS:
        if remaining <= 0:
            break
        if band_size is None:
            taxable_in_band = remaining
        else:
            taxable_in_band = min(remaining, band_size)
        tax += kes(taxable_in_band * rate)
        remaining -= taxable_in_band

    # Apply reliefs
    tax -= PERSONAL_RELIEF
    if insurance_premium > 0:
        tax -= kes(insurance_premium * INSURANCE_RELIEF_RATE)

    # PAYE cannot be negative
    tax = max(Decimal('0'), kes(tax))

    return {
        'taxable_income': kes(taxable_income),
        'gross_tax':      kes(tax + PERSONAL_RELIEF),
        'personal_relief': PERSONAL_RELIEF,
        'net_paye':        tax,
    }


# ── Master Calculator ─────────────────────────────────────────

def calculate_payslip(gross_salary, insurance_premium=Decimal('0')):
    """
    Full payslip calculation for a Kenyan employee.
    Returns a dict with all components.
    """
    gross = kes(gross_salary)

    nssf    = calculate_nssf(gross)
    shif    = calculate_shif(gross)
    housing = calculate_housing_levy(gross)
    paye    = calculate_paye(gross, nssf['total'], insurance_premium)

    total_deductions = (
        paye['net_paye'] +
        nssf['total']    +
        shif             +
        housing['employee']
    )

    net_pay = kes(gross - total_deductions)

    return {
        # Earnings
        'gross_salary':    gross,

        # Deductions
        'paye':            paye['net_paye'],
        'nssf_tier1':      nssf['tier1'],
        'nssf_tier2':      nssf['tier2'],
        'nssf_total':      nssf['total'],
        'shif':            shif,
        'housing_levy':    housing['employee'],

        # Employer contributions (for GL posting)
        'employer_nssf':   nssf['total'],    # employer matches employee
        'employer_housing': housing['employer'],

        # Totals
        'total_deductions': total_deductions,
        'net_pay':          net_pay,

        # PAYE detail
        'taxable_income':   paye['taxable_income'],
        'personal_relief':  paye['personal_relief'],
    }