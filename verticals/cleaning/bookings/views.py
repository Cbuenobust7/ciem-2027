"""Endpoints de reservas (§5.1).

Todas las vistas delegan el cambio de estado en `services`; aquí no se escribe
`booking.status` a mano en ningún sitio (§4.1). El aislamiento de §6.4 se aplica
en el queryset, no en el frontend.
"""

from django.core.exceptions import ObjectDoesNotExist
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from verticals.cleaning.errors import (
    ForbiddenRole,
    InvalidPayload,
    NotParticipant,
    ResourceNotFound,
)
from verticals.cleaning.providers.models import ProviderAccount, ProviderMembership

from . import services
from .models import Booking
from .permissions import (
    MANAGER_ROLES,
    actor_role_for,
    can_view_booking,
    is_customer,
    is_platform,
    is_provider_manager,
    is_provider_member,
    member_account_ids,
    membership_role,
    visible_bookings,
)
from .serializers import (
    BookingCreateSerializer,
    BookingDetailSerializer,
    BookingSerializer,
)

CANCEL_REASONS = {'customer', 'provider', 'incident'}

BOOKING_QUERYSET = Booking.objects.select_related(
    'account', 'resource', 'listing', 'customer', 'payment',
)


def _booking_or_404(code):
    booking = BOOKING_QUERYSET.filter(code=code).first()
    if booking is None:
        raise ResourceNotFound(
            'La reserva indicada no existe.', extra={'code': code},
        )
    return booking


def _int_param(params, name):
    raw = params.get(name)
    if raw in (None, ''):
        return None
    if not str(raw).lstrip('-').isdigit():
        raise InvalidPayload(
            f'El parámetro "{name}" debe ser numérico.',
            extra={'param': name, 'value': raw},
        )
    return int(raw)


def _datetime_param(params, name):
    raw = params.get(name)
    if not raw:
        return None
    return services.normalize_start_at(raw)


def _apply_filters(queryset, params):
    if params.get('status'):
        queryset = queryset.filter(status=params['status'])
    date_from = _datetime_param(params, 'from')
    if date_from is not None:
        queryset = queryset.filter(start_at__gte=date_from)
    date_to = _datetime_param(params, 'to')
    if date_to is not None:
        queryset = queryset.filter(start_at__lte=date_to)
    resource_id = _int_param(params, 'resource')
    if resource_id is not None:
        queryset = queryset.filter(resource_id=resource_id)
    return queryset


class BookingListCreateView(generics.ListCreateAPIView):
    """`GET /api/cleaning/bookings/` (mías) y `POST` (crear reserva)."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BookingSerializer

    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params
        queryset = (
            visible_bookings(user)
            .select_related('account', 'resource', 'listing', 'customer')
            .order_by('-start_at')
        )
        if params.get('as') == 'provider':
            queryset = queryset.filter(
                account_id__in=member_account_ids(user),
            )
        account_id = _int_param(params, 'account')
        if account_id is not None:
            queryset = queryset.filter(account_id=account_id)
        return _apply_filters(queryset, params)

    def create(self, request, *args, **kwargs):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        listing = data['listing']
        try:
            listing.service_details
        except ObjectDoesNotExist:
            raise ResourceNotFound(
                'El listing indicado no es un servicio de la vertical de limpieza.',
                extra={'listing': listing.id},
            )
        idempotency_key = (
            request.headers.get('Idempotency-Key')
            or request.META.get('HTTP_IDEMPOTENCY_KEY')
            or None
        )
        booking, created = services.create_booking(
            customer=request.user,
            listing=listing,
            start_at=data['start_at'],
            address=data['address'],
            district=data['district'],
            city=data.get('city'),
            resource=data.get('resource'),
            customer_notes=data.get('customer_notes', ''),
            idempotency_key=idempotency_key,
        )
        booking = BOOKING_QUERYSET.get(pk=booking.pk)
        return Response(
            BookingSerializer(booking).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class BookingDetailView(APIView):
    """`GET /api/cleaning/bookings/{code}/` — detalle con historial."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, code):
        booking = _booking_or_404(code)
        if not can_view_booking(request.user, booking):
            raise NotParticipant(
                'No participas en esta reserva.', extra={'booking': booking.code},
            )
        return Response(BookingDetailSerializer(booking).data)


class BookingActionView(APIView):
    """Transiciones de §4.1, una URL por acción.

    La autorización se comprueba aquí y la transición la ejecuta el servicio,
    que además valida el estado de origen. `reason` de una cancelación se
    completa en el servidor cuando el cliente no lo manda.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, code, action):
        booking = _booking_or_404(code)
        user = request.user

        if action in {'confirm', 'decline', 'start', 'complete'}:
            if not is_provider_member(user, booking):
                raise ForbiddenRole(
                    'Solo el proveedor puede hacer esta transición.',
                    extra={'booking': booking.code},
                )
        elif action == 'mark-paid':
            if not is_provider_manager(user, booking):
                raise ForbiddenRole(
                    'Solo el dueño o un administrador de la cuenta puede marcar el cobro.',
                    extra={'booking': booking.code},
                )
        elif action == 'cancel':
            if not (is_customer(user, booking) or is_provider_member(user, booking)):
                raise ForbiddenRole(
                    'Solo el cliente o el proveedor pueden cancelar esta reserva.',
                    extra={'booking': booking.code},
                )
            if booking.status == Booking.Status.IN_PROGRESS and not is_platform(user):
                raise ForbiddenRole(
                    'Una reserva en ejecución solo la puede cerrar la plataforma.',
                    extra={'booking': booking.code},
                )
        else:
            raise ResourceNotFound(
                'Acción desconocida sobre la reserva.',
                extra={'action': action, 'booking': booking.code},
            )

        role = actor_role_for(user, booking)
        booking = self._run(action, booking, user, role, request.data)
        return Response(
            BookingSerializer(BOOKING_QUERYSET.get(pk=booking.pk)).data,
        )

    def _run(self, action, booking, user, role, payload):
        if action == 'confirm':
            return services.confirm_booking(booking=booking, actor=user, role=role)
        if action == 'decline':
            return services.decline_booking(
                booking=booking, actor=user, role=role,
                detail=payload.get('detail', ''),
            )
        if action == 'start':
            return services.start_booking(booking=booking, actor=user, role=role)
        if action == 'complete':
            return services.complete_booking(booking=booking, actor=user, role=role)
        if action == 'mark-paid':
            return services.mark_paid(booking=booking, actor=user, role=role)
        return self._cancel(booking, user, role, payload)

    def _cancel(self, booking, user, role, payload):
        if booking.status == Booking.Status.IN_PROGRESS:
            # Transición 7: incidencia cerrada por la plataforma.
            return services.cancel_booking(
                booking=booking, actor=user, role=role, reason='incident',
                detail=payload.get('detail', ''),
            )
        reason = payload.get('reason') or (
            'customer' if is_customer(user, booking) else 'provider'
        )
        if reason not in CANCEL_REASONS:
            raise InvalidPayload(
                'El motivo de cancelación debe ser customer, provider o incident.',
                extra={'param': 'reason', 'value': reason},
            )
        return services.cancel_booking(
            booking=booking, actor=user, role=role, reason=reason,
            detail=payload.get('detail', ''),
        )


class ProviderBookingsView(generics.ListAPIView):
    """`GET /api/cleaning/providers/{pk}/bookings/` — la agenda del proveedor."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BookingSerializer

    def get_queryset(self):
        account = get_object_or_404(ProviderAccount, pk=self.kwargs['pk'])
        user = self.request.user
        role = membership_role(user, account)
        if is_platform(user) or role in MANAGER_ROLES:
            queryset = Booking.objects.filter(account=account)
        elif role == ProviderMembership.Role.STAFF:
            # El personal solo ve la agenda de los recursos que tiene asignados.
            queryset = Booking.objects.filter(account=account, resource__members=user)
        else:
            raise ForbiddenRole(
                'No eres miembro de esta cuenta.', extra={'account': account.id},
            )
        queryset = queryset.select_related(
            'account', 'resource', 'listing', 'customer',
        ).order_by('-start_at')
        return _apply_filters(queryset, self.request.query_params)
