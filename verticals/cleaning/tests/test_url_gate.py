from django.conf import settings
from django.test import SimpleTestCase
from django.urls import resolve, Resolver404


class CleaningRouteGateTests(SimpleTestCase):
    def test_cleaning_routes_are_absent_when_vertical_is_disabled(self):
        if settings.CLEANING_VERTICAL_ENABLED:
            self.skipTest('Este chequeo corresponde al perfil con la vertical desactivada.')
        with self.assertRaises(Resolver404):
            resolve('/api/cleaning/providers/')

    def test_base_listing_routes_remain_mounted(self):
        self.assertEqual(resolve('/api/listings/').url_name, 'listing-list')
