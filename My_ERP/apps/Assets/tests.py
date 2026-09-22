from decimal import Decimal

from django.test import SimpleTestCase

from .depreciation import slm_monthly, calculate_disposal_gain_loss


class DepreciationEngineTests(SimpleTestCase):
    def test_slm_monthly_depreciation(self):
        monthly = slm_monthly(Decimal('120000'), Decimal('0'), 60)
        self.assertEqual(monthly, Decimal('2000.00'))

    def test_disposal_gain_when_proceeds_exceed_book_value(self):
        class AssetStub:
            book_value = Decimal('10000')

        gain = calculate_disposal_gain_loss(AssetStub(), Decimal('12000'))
        self.assertEqual(gain, Decimal('2000.00'))
