"""Aceptación de ADR-04 bajo concurrencia real (§8.4).

`transaction=True` NO es opcional aquí: con el `TestCase` normal de Django cada
test corre dentro de una transacción, los hilos no ven los datos del otro y el
test pasaría siempre sin probar nada. Si alguien "simplifica" este archivo
quitando `transaction=True`, la prueba deja de tener valor.
"""

import threading

import pytest
from django.db import connection

from verticals.cleaning.bookings.errors import CleaningAPIError
from verticals.cleaning.bookings.models import Booking
from verticals.cleaning.bookings.services import create_booking

from .helpers import SLOT_START, at

pytestmark = pytest.mark.django_db(transaction=True)

THREAD_TIMEOUT = 30


def _attempt(user, listing, start_at, results, barrier, resource=None):
    # Cada hilo necesita su propia conexión: la del hilo principal está en uso.
    connection.close()
    try:
        barrier.wait(timeout=THREAD_TIMEOUT)
        booking, _ = create_booking(
            customer=user,
            listing=listing,
            start_at=start_at,
            address='Av. Arequipa 1234',
            district='san-borja',
            resource=resource,
        )
        results.append(('ok', booking.code))
    except CleaningAPIError as exc:
        results.append((exc.code, None))
    except Exception as exc:  # pragma: no cover - solo para diagnóstico
        results.append((f'{type(exc).__name__}: {exc}', None))
    finally:
        connection.close()


def _run_both(users, listing, start_at, resources=(None, None)):
    barrier = threading.Barrier(len(users))
    results = []
    threads = [
        threading.Thread(
            target=_attempt,
            args=(user, listing, start_at, results, barrier, resource),
        )
        for user, resource in zip(users, resources)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=THREAD_TIMEOUT)
    return [outcome for outcome, _ in results]


def test_only_one_of_two_simultaneous_bookings_wins(
    account, resource, service, customer, other_customer,
):
    """Dos clientes reservando el mismo tramo a la vez: exactamente una gana."""
    outcomes = _run_both([customer, other_customer], service.listing, SLOT_START)

    assert sorted(outcomes) == ['ok', 'slot_unavailable']
    assert Booking.objects.filter(resource=resource).count() == 1


def test_simultaneous_bookings_on_different_resources_both_win(
    account, resource, second_resource, service, customer, other_customer,
):
    """El invariante es por recurso: no debe sobraserializar la agenda."""
    outcomes = _run_both(
        [customer, other_customer],
        service.listing,
        at(15),
        resources=(resource, second_resource),
    )

    assert sorted(outcomes) == ['ok', 'ok']
    assert Booking.objects.count() == 2
