from django.conf import settings
from rest_framework import serializers

from .models import Listing, ListingImage
from verticals.cleaning.services.models import ServiceDetails


class ListingImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ListingImage
        fields = ['id', 'image', 'image_url', 'alt_text', 'order', 'is_cover', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class ListingListSerializer(serializers.ModelSerializer):
    seller_username = serializers.SerializerMethodField()

    def get_seller_username(self, obj):
        if getattr(settings, 'CIEM_CATALOG_ONLY', False) and obj.seller.username == settings.CIEM_CATALOG_OWNER:
            return 'CIEM'
        return obj.seller.username

    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = [
            'id', 'title', 'price', 'currency', 'is_negotiable', 'is_free',
            'condition', 'location', 'status',
            'view_count', 'favorite_count',
            'seller_username', 'cover_image',
            'created_at', 'published_at',
        ]

    def get_cover_image(self, obj):
        cover = obj.images.filter(is_cover=True).first() or obj.images.first()
        if cover and cover.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(cover.image.url)
            return cover.image.url
        return None


class ListingDetailSerializer(serializers.ModelSerializer):
    seller_username = serializers.SerializerMethodField()

    def get_seller_username(self, obj):
        if getattr(settings, 'CIEM_CATALOG_ONLY', False) and obj.seller.username == settings.CIEM_CATALOG_OWNER:
            return 'CIEM'
        return obj.seller.username

    seller_id = serializers.ReadOnlyField(source='seller.id')
    images = ListingImageSerializer(many=True, read_only=True)
    category_name = serializers.ReadOnlyField(source='category.name')
    service_details = serializers.SerializerMethodField()

    def get_service_details(self, obj):
        try:
            details = obj.service_details
        except ServiceDetails.DoesNotExist:
            return None
        return {
            'provider_account': details.provider_account_id,
            'duration_minutes': details.duration_minutes,
            'buffer_minutes': details.buffer_minutes,
            'capacity': details.capacity,
            'min_notice_hours': details.min_notice_hours,
            'max_horizon_days': details.max_horizon_days,
            'cancellation_hours': details.cancellation_hours,
            'requires_deposit': details.requires_deposit,
            'deposit_amount': str(details.deposit_amount),
            'resolves_address': details.resolves_address,
            'is_instant': details.is_instant,
            'max_per_day': details.max_per_day,
            'is_active': details.is_active,
        }

    def validate(self, attrs):
        if self.instance and self.instance.status in ('sold', 'expired'):
            raise serializers.ValidationError(
                {'detail': 'No se puede editar un anuncio vendido o expirado.'}
            )
        return attrs

    class Meta:
        model = Listing
        fields = [
            'id', 'seller_id', 'seller_username',
            'title', 'description', 'price', 'currency',
            'is_negotiable', 'is_free',
            'category', 'category_name',
            'condition',
            'location', 'latitude', 'longitude',
            'status', 'view_count', 'favorite_count',
            'images',
            'service_details',
            'created_at', 'updated_at', 'published_at', 'expires_at',
        ]
        read_only_fields = [
            'id', 'seller_id', 'seller_username',
            'status',
            'view_count', 'favorite_count',
            'created_at', 'updated_at', 'published_at',
        ]
