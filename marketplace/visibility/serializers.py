from rest_framework import serializers

from .models import City, VisibilityPurchase


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = [
            "id", "name", "slug", "premium_slots_count",
            "price", "currency", "duration_days", "is_promo_mode",
        ]


class SlotSerializer(serializers.Serializer):
    """Representa UNA posición del grid tipo 'asientos de avión'."""
    position = serializers.IntegerField()
    status = serializers.ChoiceField(choices=["available", "occupied"])
    price = serializers.DecimalField(max_digits=8, decimal_places=2)
    currency = serializers.CharField()
    is_free = serializers.BooleanField()
    occupied_until = serializers.DateTimeField(required=False, allow_null=True)


class CityAvailabilitySerializer(serializers.Serializer):
    city = CitySerializer()
    slots = SlotSerializer(many=True)


class VisibilityPurchaseSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source="city.name", read_only=True)

    class Meta:
        model = VisibilityPurchase
        fields = [
            "id", "seller", "city", "city_name",
            "position", "starts_at", "ends_at",
            "price", "currency", "is_promo", "status",
            "mp_preference_id", "mp_order_id", "payment",
            "created_at",
        ]
        read_only_fields = [
            "id", "seller", "starts_at", "ends_at",
            "price", "currency", "is_promo", "status",
            "mp_preference_id", "mp_order_id", "payment", "created_at",
        ]


class FeaturedSellerSerializer(serializers.ModelSerializer):
    seller_id = serializers.IntegerField(
        source="seller.id",
        read_only=True,
    )
    seller_username = serializers.CharField(
        source="seller.username",
        read_only=True,
    )
    city = CitySerializer(read_only=True)
    listing_count = serializers.IntegerField(
        source="_listing_count",
        read_only=True,
    )

    class Meta:
        model = VisibilityPurchase
        fields = [
            "seller_id",
            "seller_username",
            "city",
            "position",
            "starts_at",
            "ends_at",
            "listing_count",
        ]