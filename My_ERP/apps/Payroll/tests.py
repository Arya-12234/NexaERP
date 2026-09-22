from decimal import Decimal

from django.test import SimpleTestCase

from .tax_engine import calculate_nssf, calculate_payslip


class TaxEngineTests(SimpleTestCase):
    def test_nssf_caps_at_upper_earnings_limit(self):
        result = calculate_nssf(Decimal('50000'))
        self.assertEqual(result['total'], Decimal('2160.00'))

    def test_payslip_returns_positive_net_pay(self):
        payslip = calculate_payslip(Decimal('100000'))
        self.assertGreater(payslip['gross_salary'], Decimal('0'))
        self.assertGreater(payslip['net_pay'], Decimal('0'))
        self.assertLess(payslip['net_pay'], payslip['gross_salary'])
