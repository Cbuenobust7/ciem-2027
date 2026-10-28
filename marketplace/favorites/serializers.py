from rest_framework import serializers

from .models import Favorite


class FavoriteSerializer(serializers.ModelSerializer):
    listing_title = serializers.CharField(
        source="listing.title",
        read_only=True,
    )

    listing_seller = serializers.CharField(
        source="listing.seller.username",
        read_only=True,
    )

    class Meta:
        model = Favorite
        fields = [
            "id",
            "listing",
            "listing_title",
            "listing_seller",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "listing_title",
            "listing_seller",
        ]

    def validate_listing(self, listing):
        """Evita que un usuario añada el mismo listing dos veces."""
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            return listing

        if Favorite.objects.filter(
            user=request.user,
            listing=listing,
        ).exists():
            raise serializers.ValidationError(
                "Este anuncio ya está en favoritos."
            )

        return listing