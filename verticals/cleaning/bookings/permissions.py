"""Permisos y aislamiento de datos de las reservas (§6.1, §6.2, §6.4).

La regla que no se negocia: **todo** queryset de reservas pasa por
`visible_bookings()`. El filtro del frontend no autoriza nada.

Roles efectivos sobre una reserva:

- `platform`: `is_staff` (ve y puede todo).
- `customer`: es el cliente de esa reserva.
- `owner` / `admin`: es miembro de la cuenta con ese rol.
- `staff`: es miembro con rol `staff` **y** está asignado al recurso de la
  reserva. Para *verla*, claro: para confirmar/iniciar/completar basta con ser
  miembro (§4.1 y §6.1).
"""

from django.db.models import Q
from rest_framework.permissions import BasePermission

from verticals.cleaning.errors import ForbiddenRole, NotParticipant
from verticals.cleaning.providers.models import (
    ProviderMembership,
    ProviderResource,
)
from verticals.cleaning.providers.permissions import membership_for

from .models import Booking

MANAGER_ROLES = (ProviderMembership.Role.OWNER, ProviderMembership.Role.ADMIN)


def is_platform(user):
    return bool(user and user.is_authenticated and user.is_staff)


def membership_role(user, account):
    membership = membership_for(user, account)
    return membership.role if membership else None


def is_provider_member(user, booking):
    """Cualquier miembro activo de la cuenta: basta para las transiciones."""
    return is_platform(user) or membership_role(user, booking.account) is not None


def is_provider_manager(user, booking):
    """`owner`/`admin` (o plataforma): perfil, precios y cobro manual."""
    return is_platform(user) or membership_role(user, booking.account) in MANAGER_ROLES


def is_customer(user, booking):
    return bool(user and user.is_authenticated and booking.customer_id == user.id)


def is_assigned_staff(user, booking):
    if membership_role(user, booking.account) != ProviderMembership.Role.STAFF:
        return False
    return booking.resource.members.filter(pk=user.pk).exists()


def can_view_booking(user, booking):
    if not user or not user.is_authenticated:
        return False
    if is_platform(user) or is_customer(user, booking):
        return True
    role = membership_role(user, booking.account)
    if role in MANAGER_ROLES:
        return True
    if role == ProviderMembership.Role.STAFF:
        return is_assigned_staff(user, booking)
    return False


def actor_role_for(user, booking):
    """Rol con el que se firma el `BookingEvent`."""
    if is_platform(user):
        return 'platform'
    if is_customer(user, booking):
        return 'customer'
    return membership_role(user, booking.account) or ''


def visible_bookings(user):
    """Reservas que el usuario puede ver, ya filtradas por participación (§6.4)."""
    queryset = Booking.objects.all()
    if not user or not user.is_authenticated:
        return queryset.none()
    if user.is_staff:
        return queryset

    memberships = user.provider_memberships.filter(is_active=True)
    manager_accounts = memberships.filter(role__in=MANAGER_ROLES).values_list(
        'account_id', flat=True,
    )
    staff_accounts = memberships.filter(
        role=ProviderMembership.Role.STAFF,
    ).values_list('account_id', flat=True)
    staff_resources = ProviderResource.objects.filter(
        account_id__in=list(staff_accounts), members=user,
    ).values_list('id', flat=True)

    return queryset.filter(
        Q(customer=user)
        | Q(account_id__in=list(manager_accounts))
        | Q(resource_id__in=list(staff_resources))
    ).distinct()


def member_account_ids(user):
    """Cuentas donde el usuario es miembro activo (para `?as=provider`)."""
    if not user or not user.is_authenticated:
        return []
    if user.is_staff:
        return list(Booking.objects.values_list('account_id', flat=True).distinct())
    return list(
        user.provider_memberships
        .filter(is_active=True)
        .values_list('account_id', flat=True)
    )


# ---------------------------------------------------------------------------
# Clases de permiso (object-level: booking)
# ---------------------------------------------------------------------------
class IsBookingParticipant(BasePermission):
    """`booking.customer` o miembro de la cuenta (§6.2)."""

    message = 'No participas en esta reserva.'

    def has_object_permission(self, request, view, obj):
        if can_view_booking(request.user, obj):
            return True
        raise NotParticipant(
            'No participas en esta reserva.',
            extra={'booking': obj.code},
        )


class IsBookingProviderSide(BasePermission):
    """Miembro de la cuenta (cualquier rol) o plataforma: confirmar, iniciar, completar."""

    message = 'Solo el proveedor puede hacer esta transición.'

    def has_object_permission(self, request, view, obj):
        if is_provider_member(request.user, obj):
            return True
        raise ForbiddenRole(
            'Solo el proveedor puede hacer esta transición.',
            extra={'booking': obj.code},
        )


class IsBookingCustomer(BasePermission):
    """`booking.customer == user` (pagar, cancelar como cliente)."""

    message = 'Solo el cliente de la reserva puede hacer esto.'

    def has_object_permission(self, request, view, obj):
        if is_customer(request.user, obj):
            return True
        raise ForbiddenRole(
            'Solo el cliente de la reserva puede hacer esto.',
            extra={'booking': obj.code},
        )


class IsBookingProviderManager(BasePermission):
    """`owner`/`admin` o plataforma (cobro manual, §6.1)."""

    message = 'Solo el dueño o un administrador de la cuenta puede hacer esto.'

    def has_object_permission(self, request, view, obj):
        if is_provider_manager(request.user, obj):
            return True
        raise ForbiddenRole(
            'Solo el dueño o un administrador de la cuenta puede hacer esto.',
            extra={'booking': obj.code},
        )
