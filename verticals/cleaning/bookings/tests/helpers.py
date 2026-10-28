"""Utilidades compartidas por los tests de reservas.

Las horas se construyen **relativas al reloj**: el día base es pasado mañana, de
modo que las validaciones de aviso mínimo (12 h por defecto) y de horizonte
(30 días) se cumplen siempre y la suite no caduca con el calendario.

`at(15)` sigue siendo las 10:00 de `America/Lima` (UTC-5), la zona del despliegue
de referencia, y `SLOT_START` las 10:00 del día base.
"""

from datetime import datetime, time, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.utils import timezone

from marketplace.listings.models import Listing
from verticals.cleaning.services.models import ServiceDetails

User = get_user_model()

LIMA = ZoneInfo('America/Lima')
UTC = dt_timezone.utc


def _base_day():
    """Pasado mañana en hora de Lima: margen de sobra para el aviso mínimo."""
    return (
        timezone.localtime(timezone.now()).astimezone(LIMA) + timedelta(days=2)
    ).date()


BASE_DAY = _base_day()
# 10:00 en Lima == 15:00 UTC.
SLOT_START = datetime.combine(BASE_DAY, time(10, 0), tzinfo=LIMA).astimezone(UTC)


def at(hour, minute=0, day=None):
    """Hora local del día base expresada en UTC (`at(15)` = 10:00 de Lima).

    El parámetro `day` se conserva por compatibilidad con los tests del slice 0;
    ya no se usa porque las fechas son relativas al reloj a propósito.
    """
    return datetime.combine(
        BASE_DAY, time(hour - 5, minute), tzinfo=LIMA,
    ).astimezone(UTC)


def make_user(username):
    return User.objects.create_user(
        username=username,
        email=f'{username}@test.local',
        password='test-pass-1234',
    )


def make_service(
    account,
    *,
    duration_minutes=180,
    buffer_minutes=30,
    price='120.00',
    title='Limpieza profunda de departamento',
    **extra,
):
    listing = Listing.objects.create(
        seller=account.owner,
        title=title,
        description='Servicio de prueba',
        price=Decimal(price),
        currency='PEN',
        status='active',
    )
    return ServiceDetails.objects.create(
        listing=listing,
        provider_account=account,
        duration_minutes=duration_minutes,
        buffer_minutes=buffer_minutes,
        **extra,
    )


def pgcode(exc):
    """SQLSTATE de una excepción de base de datos, esté donde esté envuelto."""
    return getattr(getattr(exc, '__cause__', None), 'pgcode', None) or getattr(
        exc, 'pgcode', None,
    )


def make_amounts(price='120.00', platform_fee='12.00'):
    """Importes coherentes con la CheckConstraint `booking_amounts_sum_to_price`.

    Se usan al crear reservas directamente por ORM (por ejemplo, un hold vencido),
    sin pasar por `create_booking`.
    """
    price = Decimal(price)
    platform_fee = Decimal(platform_fee)
    return {
        'price': price,
        'zone_fee': Decimal('0'),
        'currency': 'PEN',
        'platform_fee': platform_fee,
        'provider_amount': price - platform_fee,
        'deposit_amount': Decimal('0'),
    }
