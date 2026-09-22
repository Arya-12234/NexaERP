"""
depreciation.py — Fixed Assets Depreciation Engine
====================================================
Implements two methods used in real-world ERP systems:

1. Straight-Line Method (SLM)
   - Used for: buildings, furniture, office equipment
   - Formula: (Cost - Salvage) / Useful Life in months
   - KRA default for most asset classes

2. Declining Balance Method (DBM)
   - Used for: vehicles, computers, machinery
   - Formula: Book Value × (Rate / 12)
   - Rate is typically 2× the SLM rate (double declining)
   - Switches to SLM when SLM gives higher depreciation

All amounts in KES. All calculations return Decimal.
"""

from decimal import Decimal, ROUND_HALF_UP


def kes(value):
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


# ── Straight-Line Method ──────────────────────────────────────

def slm_monthly(cost, salvage, useful_life_months):
    """
    Monthly depreciation under Straight-Line Method.
    Args:
        cost               : original purchase cost (KES)
        salvage            : residual/salvage value (KES)
        useful_life_months : total useful life in months
    Returns:
        monthly depreciation amount (KES)
    """
    cost               = kes(cost)
    salvage            = kes(salvage)
    useful_life_months = int(useful_life_months)

    if useful_life_months <= 0:
        raise ValueError('Useful life must be greater than zero.')
    if salvage > cost:
        raise ValueError('Salvage value cannot exceed cost.')

    return kes((cost - salvage) / useful_life_months)


def slm_schedule(cost, salvage, useful_life_months, accumulated_depreciation=Decimal('0')):
    """
    Generate full SLM depreciation schedule from current state.
    Returns list of monthly entries until fully depreciated.
    """
    cost                     = kes(cost)
    salvage                  = kes(salvage)
    accumulated_depreciation = kes(accumulated_depreciation)
    monthly                  = slm_monthly(cost, salvage, useful_life_months)
    depreciable_amount       = cost - salvage
    book_value               = cost - accumulated_depreciation

    schedule = []
    period   = 1

    while book_value > salvage and period <= useful_life_months:
        # Last period adjustment
        actual_depreciation = min(monthly, book_value - salvage)
        actual_depreciation = max(Decimal('0'), actual_depreciation)

        book_value -= actual_depreciation
        accumulated_depreciation += actual_depreciation

        schedule.append({
            'period':                  period,
            'depreciation':            actual_depreciation,
            'accumulated_depreciation':accumulated_depreciation,
            'book_value':              book_value,
        })
        period += 1

    return schedule


# ── Declining Balance Method ──────────────────────────────────

def dbm_monthly(book_value, annual_rate):
    """
    Monthly depreciation under Declining Balance Method.
    Args:
        book_value   : current net book value (KES)
        annual_rate  : annual depreciation rate as decimal (e.g. 0.25 for 25%)
    Returns:
        monthly depreciation amount (KES)
    """
    book_value   = kes(book_value)
    annual_rate  = Decimal(str(annual_rate))
    return kes(book_value * annual_rate / 12)


def dbm_schedule(cost, salvage, useful_life_months, annual_rate,
                 accumulated_depreciation=Decimal('0')):
    """
    Generate full DBM depreciation schedule.
    Switches to SLM when SLM gives a higher monthly charge
    (standard DBM-to-SLM switch used in SAP and Oracle).
    """
    cost                     = kes(cost)
    salvage                  = kes(salvage)
    annual_rate              = Decimal(str(annual_rate))
    accumulated_depreciation = kes(accumulated_depreciation)
    book_value               = cost - accumulated_depreciation
    remaining_periods        = useful_life_months - int(
        accumulated_depreciation / slm_monthly(cost, salvage, useful_life_months)
        if slm_monthly(cost, salvage, useful_life_months) > 0 else 0
    )

    schedule = []
    period   = 1
    max_periods = useful_life_months * 2  # safety cap

    while book_value > salvage and period <= max_periods:
        remaining = useful_life_months - period + 1
        if remaining <= 0:
            break

        dbm_charge = dbm_monthly(book_value, annual_rate)
        # Switch to SLM if SLM gives higher depreciation
        slm_charge = kes((book_value - salvage) / remaining) if remaining > 0 else Decimal('0')
        monthly    = max(dbm_charge, slm_charge)
        monthly    = min(monthly, book_value - salvage)
        monthly    = max(Decimal('0'), monthly)

        if monthly <= 0:
            break

        book_value               -= monthly
        accumulated_depreciation += monthly

        schedule.append({
            'period':                  period,
            'depreciation':            monthly,
            'accumulated_depreciation':accumulated_depreciation,
            'book_value':              max(book_value, salvage),
            'method_used':             'SLM' if slm_charge >= dbm_charge else 'DBM',
        })
        period += 1

    return schedule


# ── Master Calculator ─────────────────────────────────────────

def calculate_next_depreciation(asset):
    """
    Calculate the next monthly depreciation charge for an asset.
    Returns the depreciation amount for this period.
    """
    from .models import Asset

    if asset.status != Asset.Status.ACTIVE:
        return Decimal('0')

    book_value = asset.book_value

    if book_value <= asset.salvage_value:
        return Decimal('0')  # fully depreciated

    if asset.depreciation_method == Asset.DepreciationMethod.SLM:
        charge = slm_monthly(asset.cost, asset.salvage_value, asset.useful_life_months)
        # Don't depreciate below salvage
        charge = min(charge, book_value - asset.salvage_value)

    elif asset.depreciation_method == Asset.DepreciationMethod.DBM:
        charge = dbm_monthly(book_value, asset.depreciation_rate)
        charge = min(charge, book_value - asset.salvage_value)

    else:
        charge = Decimal('0')

    return max(Decimal('0'), kes(charge))


def calculate_disposal_gain_loss(asset, disposal_proceeds):
    """
    Calculate gain or loss on disposal.
    Gain  = Disposal Proceeds - Book Value  (positive)
    Loss  = Book Value - Disposal Proceeds  (negative)
    """
    disposal_proceeds = kes(disposal_proceeds)
    book_value        = kes(asset.book_value)
    return kes(disposal_proceeds - book_value)