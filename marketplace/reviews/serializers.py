from rest_framework import serializers

# La reseña verificada es de la vertical (ADR-09); su código de error estable
# vive allí. La importación es inocua si la vertical está desactivada: el módulo
# solo depende de DRF.
from verticals.cleaning.errors import AlreadyReviewed

from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.ReadOnlyField(source='reviewer.username')
    seller_username = serializers.ReadOnlyField(source='seller.username')
    listing_title = serializers.ReadOnlyField(source='listing.title')
    # Con `ReadOnlyField(source='booking.code')` DRF omitiría la clave cuando no
    # hay reserva (salta el campo si un tramo de la fuente es None), y el
    # contrato quedaría inestable. Un método la devuelve siempre.
    booking_code = serializers.SerializerMethodField()

    def get_booking_code(self, obj):
        return obj.booking.code if obj.booking_id else None

    class Meta:
        model = Review
        fields = [
            'id',
            'reviewer', 'reviewer_username',
            'seller', 'seller_username',
            'listing', 'listing_title',
            'booking', 'booking_code', 'is_verified',
            'rating', 'comment',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id',
            'reviewer', 'reviewer_username',
            'seller', 'seller_username',
            'listing_title',
            'booking_code', 'is_verified',
            'created_at', 'updated_at',
        ]

    def validate_rating(self, value):
        if value < 1 or value > 5:
            return serializers.ValidationError(
                'El rating debe estar entre 1 y 5.'
            )
        return value

    def validate(self, attrs):
        request = self.context.get('request')

        if not request or not request.user.is_authenticated:
            return attrs

        booking = attrs.get('booking')
        if booking is None and self.instance is not None:
            booking = self.instance.booking

        if booking is not None:
            return self._validate_booking_review(attrs, booking, request.user)

        # Reseña clásica de producto: el paquete base sigue funcionando igual.
        if self.instance is None and 'listing' not in attrs:
            raise serializers.ValidationError({
                'listing': 'Este campo es requerido para crear una reseña.'
            })

        listing = attrs.get('listing')
        if listing and request.user.id == listing.seller_id:
            raise serializers.ValidationError(
                'No puedes reseñarte a ti mismo.'
            )
        if listing and Review.objects.filter(
            reviewer=request.user,
            listing=listing,
        ).exists():
            raise serializers.ValidationError(
                'Ya has reseñado este anuncio.'
            )
        return attrs

    def _validate_booking_review(self, attrs, booking, user):
        """Solo el cliente, solo una reserva completada y solo una vez (ADR-09)."""
        if booking.customer_id != user.id:
            raise serializers.ValidationError({
                'booking': 'Solo el cliente de la reserva puede reseñarla.'
            })
        if booking.status != 'completed':
            raise serializers.ValidationError({
                'booking': 'La reserva todavía no está completada.'
            })
        if self.instance is None and Review.objects.filter(booking=booking).exists():
            raise AlreadyReviewed(
                'Esa reserva ya tiene una reseña.',
                extra={'booking': booking.code},
            )
        return attrs
