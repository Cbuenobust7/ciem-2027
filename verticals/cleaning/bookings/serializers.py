"""Serializers de `cleaning_bookings`.

`BookingSerializer` reproduce **exactamente** la forma de §5.2 (el 201 de la
creación) y se usa también para listar y para las transiciones.
`BookingDetailSerializer` añade lo que el detalle necesita: dirección, notas,
motivos de cancelación, marcas de tiempo e historial de eventos.

El importe **no** viaja en la petición (ADR-08): el cliente no propone precio.
"""

from rest_framework import serializers

from marketplace.listings.models import Listing
from marketplace.visibility.models import City
from verticals.cleaning.providers.models import ProviderResource

from .models import Booking, BookingEvent


class BookingCreateSerializer(serializers.Serializer):
    """Cuerpo de `POST /api/cleaning/bookings/` (§5.2)."""

    listing = serializers.PrimaryKeyRelatedField(queryset=Listing.objects.all())
    resource = serializers.PrimaryKeyRelatedField(
        queryset=ProviderResource.objects.all(), required=False, allow_null=True,
    )
    start_at = serializers.DateTimeField()
    city = serializers.PrimaryKeyRelatedField(
        queryset=City.objects.all(), required=False, allow_null=True,
    )
    address = serializers.CharField(max_length=500)
    district = serializers.CharField(max_length=80)
    customer_notes = serializers.CharField(
        required=False, allow_blank=True, default='',
    )


class BookingSerializer(serializers.ModelSerializer):
    """Forma del contrato §5.2."""

    service = serializers.SerializerMethodField()
    account = serializers.SerializerMethodField()
    resource = serializers.SerializerMethodField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    zone_fee = serializers.DecimalField(max_digits=10, decimal_places=2)
    platform_fee = serializers.DecimalField(max_digits=10, decimal_places=2)
    provider_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    deposit_amount = serializers.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        model = Booking
        fields = [
            'code', 'status', 'hold_expires_at', 'start_at', 'end_at',
            'occupies_until', 'service', 'account', 'resource',
            'price', 'zone_fee', 'currency', 'platform_fee', 'provider_amount',
            'deposit_amount', 'payment_status',
        ]

    def get_service(self, obj):
        details = getattr(obj.listing, 'service_details', None)
        return {
            'listing': obj.listing_id,
            'title': obj.service_title,
            'duration_minutes': details.duration_minutes if details else None,
            'buffer_minutes': obj.buffer_minutes,
        }

    def get_account(self, obj):
        return {'id': obj.account_id, 'display_name': obj.account.display_name}

    def get_resource(self, obj):
        return {'id': obj.resource_id, 'name': obj.resource.name}


class BookingEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source='actor.username', default=None, read_only=True,
    )

    class Meta:
        model = BookingEvent
        fields = [
            'id', 'event_type', 'from_status', 'to_status', 'actor_role',
            'actor_username', 'reason', 'created_at',
        ]


class BookingDetailSerializer(BookingSerializer):
    """Detalle: lo del contrato más el contexto y el historial (§5.1)."""

    events = BookingEventSerializer(many=True, read_only=True)

    class Meta(BookingSerializer.Meta):
        fields = BookingSerializer.Meta.fields + [
            'address', 'district', 'city', 'customer_notes', 'provider_notes',
            'cancel_reason', 'cancel_detail', 'confirmed_at', 'started_at',
            'completed_at', 'cancelled_at', 'created_at', 'events',
        ]
