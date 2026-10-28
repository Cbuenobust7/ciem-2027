from datetime import timedelta
import logging

from django.db import models as db_models, transaction
from django.utils import timezone

from .models import City, VisibilityPurchase


logger = logging.getLogger(__name__)

PENDING_RESERVATION_TIMEOUT = timedelta(minutes=15)


def _reserved_or_active_for_city(city):
    """
    Devuelve las compras que actualmente hacen que una posición
    no esté disponible.

    Se consideran no disponibles:

    - PAID que todavía están vigentes.
    - PENDING creadas dentro de los últimos 15 minutos.

    Una compra PENDING más antigua se considera una reserva
    abandonada y deja de bloquear la posición.
    """
    now = timezone.now()
    cutoff = now - PENDING_RESERVATION_TIMEOUT

    return VisibilityPurchase.objects.filter(
        city=city
    ).filter(
        db_models.Q(
            status=VisibilityPurchase.Status.PAID,
            starts_at__lte=now,
            ends_at__gt=now,
        )
        | db_models.Q(
            status=VisibilityPurchase.Status.PENDING,
            created_at__gte=cutoff,
        )
    )


def _build_slots(city):
    """
    Construye el grid completo de posiciones premium.

    Los slots disponibles reflejan el precio/moneda/modo-promo
    actual de la ciudad. Los ocupados incluyen tanto los PAID
    vigentes como las PENDING recientes (reservas temporales).
    """
    reserved_or_active = _reserved_or_active_for_city(city)

    occupied_by_position = {
        purchase.position: purchase
        for purchase in reserved_or_active
    }

    slots = []

    for position in range(1, city.premium_slots_count + 1):
        purchase = occupied_by_position.get(position)

        if purchase:
            slots.append({
                "position": position,
                "status": "occupied",
                "price": purchase.price,
                "currency": purchase.currency,
                "is_free": purchase.is_promo,
                "occupied_until": (
                    purchase.ends_at
                    if purchase.status == VisibilityPurchase.Status.PAID
                    else None
                ),
            })
        else:
            slots.append({
                "position": position,
                "status": "available",
                "price": city.price,
                "currency": city.currency,
                "is_free": city.is_promo_mode,
                "occupied_until": None,
            })

    return slots


@transaction.atomic
def claim_free_slot(seller, city, position):
    """
    Reclama una posición gratuita mientras is_promo_mode esté activo.

    Bloquea la ciudad con select_for_update() para evitar doble
    asignación concurrente. También considera reservas temporales
    (PENDING recientes) como no disponibles.
    """
    city = City.objects.select_for_update().get(pk=city.pk)

    if not city.is_promo_mode:
        raise ValueError("Esta ciudad ya no está en modo promoción.")

    if position < 1 or position > city.premium_slots_count:
        raise ValueError(
            f"Posición inválida. Debe estar entre 1 y {city.premium_slots_count}."
        )

    reserved = _reserved_or_active_for_city(city)

    if reserved.filter(position=position).exists():
        raise ValueError("Esa posición ya está ocupada o reservada.")

    if reserved.filter(seller=seller).exists():
        raise ValueError(
            "Ya tienes un espacio activo o una compra pendiente en esta ciudad."
        )

    now = timezone.now()

    purchase = VisibilityPurchase.objects.create(
        seller=seller,
        city=city,
        position=position,
        starts_at=now,
        ends_at=now + timedelta(days=city.duration_days),
        price=0,
        currency=VisibilityPurchase.Currency.PEN,
        is_promo=True,
        status=VisibilityPurchase.Status.PAID,
    )

    return purchase


@transaction.atomic
def create_paid_purchase(seller, city, position):
    """
    Crea una compra PENDING para una posición premium.

    Una compra PENDING reciente reserva temporalmente la posición
    durante PENDING_RESERVATION_TIMEOUT para evitar que dos usuarios
    puedan iniciar simultáneamente una compra sobre el mismo slot.
    """
    city = City.objects.select_for_update().get(pk=city.pk)

    if position < 1 or position > city.premium_slots_count:
        raise ValueError(
            f"Posición inválida. Debe estar entre 1 y {city.premium_slots_count}."
        )

    reserved = _reserved_or_active_for_city(city)

    if reserved.filter(position=position).exists():
        raise ValueError("Esa posición ya está ocupada o reservada.")

    if reserved.filter(seller=seller).exists():
        raise ValueError(
            "Ya tienes un espacio activo o una compra pendiente en esta ciudad."
        )

    now = timezone.now()

    purchase = VisibilityPurchase.objects.create(
        seller=seller,
        city=city,
        position=position,
        starts_at=now,
        ends_at=now + timedelta(days=city.duration_days),
        price=city.price,
        currency=city.currency,
        is_promo=False,
        status=VisibilityPurchase.Status.PENDING,
    )

    return purchase


@transaction.atomic
def activate_purchase_from_payment(payment):
    """
    Activa una compra cuando se recibe la señal payment_completed.

    Segunda barrera de seguridad:
    antes de activar, vuelve a comprobar que la posición no haya sido
    ocupada por otra compra PAID.

    La ciudad se bloquea con select_for_update() para serializar
    activaciones concurrentes de posiciones dentro de la misma ciudad.

    Si existe un conflicto, la compra se cancela y se registra un error.
    El pago ya realizado requerirá posteriormente un reembolso.
    """
    purchase_id = payment.metadata.get("purchase_id")

    if not purchase_id:
        return None

    try:
        purchase = (
            VisibilityPurchase.objects
            .select_related("city")
            .select_for_update()
            .get(id=purchase_id)
        )
    except VisibilityPurchase.DoesNotExist:
        return None

    if purchase.status == VisibilityPurchase.Status.PAID:
        return purchase

    # Bloqueamos la ciudad antes de comprobar el conflicto y activar.
    city = City.objects.select_for_update().get(pk=purchase.city_id)

    # Volvemos a obtener la compra dentro de la misma transacción.
    purchase = (
        VisibilityPurchase.objects
        .select_related("city")
        .select_for_update()
        .get(pk=purchase.pk)
    )

    # Puede haber sido activada mientras esperábamos el lock.
    if purchase.status == VisibilityPurchase.Status.PAID:
        return purchase

    conflict = (
        VisibilityPurchase.objects
        .active_for_city(city)
        .filter(position=purchase.position)
        .exclude(pk=purchase.pk)
        .exists()
    )

    if conflict:
        purchase.status = VisibilityPurchase.Status.CANCELLED
        purchase.payment = payment
        purchase.save(
            update_fields=["status", "payment", "updated_at"]
        )

        logger.error(
            "Conflicto de posición al activar purchase %s: "
            "posición %s en ciudad %s ya ocupada. "
            "El pago %s requiere reembolso.",
            purchase.id,
            purchase.position,
            city.name,
            payment.id,
        )

        return purchase

    purchase.payment = payment
    purchase.activate()

    return purchase
