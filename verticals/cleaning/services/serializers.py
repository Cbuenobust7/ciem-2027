from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from marketplace.categories.models import Category
from marketplace.listings.models import Listing
from verticals.cleaning.providers.models import ProviderAccount
from verticals.cleaning.providers.permissions import can_manage_provider

from .models import ServiceDetails


class CleaningServiceSerializer(serializers.ModelSerializer):
    listing_id = serializers.IntegerField(read_only=True)
    provider_account = serializers.PrimaryKeyRelatedField(
        queryset=ProviderAccount.objects.filter(is_active=True),
        write_only=True,
        required=True,
    )
    title = serializers.CharField(max_length=200, write_only=True)
    description = serializers.CharField(write_only=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, write_only=True)
    currency = serializers.ChoiceField(choices=Listing.CURRENCY_CHOICES, write_only=True, default='PEN')
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True), write_only=True,
    )
    location = serializers.CharField(max_length=200, write_only=True, required=False, allow_blank=True, default='')
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True, write_only=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True, write_only=True)

    class Meta:
        model = ServiceDetails
        fields = [
            'id', 'listing_id', 'provider_account', 'title', 'description', 'price',
            'currency', 'category', 'location', 'latitude', 'longitude',
            'duration_minutes', 'buffer_minutes', 'capacity', 'min_notice_hours',
            'max_horizon_days', 'cancellation_hours', 'requires_deposit',
            'deposit_amount', 'resolves_address', 'is_instant', 'max_per_day',
            'is_active',
        ]
        read_only_fields = ['id', 'listing_id']

    def validate(self, attrs):
        request = self.context['request']
        account = attrs.get('provider_account') or self.instance.provider_account
        if self.instance and account.pk != self.instance.provider_account_id:
            raise serializers.ValidationError({
                'provider_account': 'La cuenta de un servicio no puede cambiarse.',
            })
        if not can_manage_provider(request.user, account):
            raise serializers.ValidationError({'provider_account': 'forbidden_role'})
        if not account.can_operate:
            raise serializers.ValidationError({
                'provider_account': 'provider_not_operational',
            })

        category = attrs.get('category')
        if category is not None:
            root = category
            while root.parent_id:
                root = root.parent
            if root.slug != 'limpieza':
                raise serializers.ValidationError({
                    'category': 'La categoría debe pertenecer a la raíz Limpieza.',
                })

        price = attrs.get('price')
        if price is not None and price < 0:
            raise serializers.ValidationError({'price': 'El precio no puede ser negativo.'})

        if self.instance:
            current_listing = self.instance.listing
            price = attrs.get('price', current_listing.price)
            requires_deposit = attrs.get('requires_deposit', self.instance.requires_deposit)
            deposit_amount = attrs.get('deposit_amount', self.instance.deposit_amount)
            if requires_deposit and deposit_amount > price:
                raise serializers.ValidationError({
                    'deposit_amount': 'El depósito no puede ser mayor que el precio del servicio.',
                })
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        account = validated_data.pop('provider_account')
        listing = Listing.objects.create(
            seller=account.owner,
            title=validated_data.pop('title'),
            description=validated_data.pop('description'),
            price=validated_data.pop('price'),
            currency=validated_data.pop('currency', 'PEN'),
            category=validated_data.pop('category'),
            location=validated_data.pop('location', ''),
            latitude=validated_data.pop('latitude', None),
            longitude=validated_data.pop('longitude', None),
            status='draft',
        )
        details = ServiceDetails(listing=listing, provider_account=account, **validated_data)
        try:
            details.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        details.save()
        return details

    @transaction.atomic
    def update(self, instance, validated_data):
        listing_fields = {
            'title': 'title', 'description': 'description', 'price': 'price',
            'currency': 'currency', 'category': 'category', 'location': 'location',
            'latitude': 'latitude', 'longitude': 'longitude',
        }
        for incoming, model_field in listing_fields.items():
            if incoming in validated_data:
                setattr(instance.listing, model_field, validated_data.pop(incoming))
        if instance.listing.status in {'active', 'rejected'}:
            instance.listing.status = 'draft'
            instance.listing.rejection_reason = ''
            instance.listing.reviewed_at = None
            instance.listing.reviewed_by = None
        instance.listing.save()
        validated_data.pop('provider_account', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        instance.save()
        return instance


class CleaningServiceReadSerializer(serializers.ModelSerializer):
    listing = serializers.IntegerField(source='listing_id', read_only=True)
    provider_account_id = serializers.IntegerField(read_only=True)
    title = serializers.CharField(source='listing.title', read_only=True)
    description = serializers.CharField(source='listing.description', read_only=True)
    price = serializers.DecimalField(source='listing.price', max_digits=10, decimal_places=2, read_only=True)
    currency = serializers.CharField(source='listing.currency', read_only=True)
    category = serializers.IntegerField(source='listing.category_id', read_only=True)
    location = serializers.CharField(source='listing.location', read_only=True)
    status = serializers.CharField(source='listing.status', read_only=True)
    rejection_reason = serializers.CharField(source='listing.rejection_reason', read_only=True)
    reviewed_at = serializers.DateTimeField(source='listing.reviewed_at', read_only=True)

    class Meta:
        model = ServiceDetails
        fields = [
            'id', 'listing', 'provider_account_id', 'title', 'description', 'price',
            'currency', 'category', 'location', 'status', 'rejection_reason', 'reviewed_at', 'duration_minutes',
            'buffer_minutes', 'capacity', 'min_notice_hours', 'max_horizon_days',
            'cancellation_hours', 'requires_deposit', 'deposit_amount',
            'resolves_address', 'is_instant', 'max_per_day', 'is_active',
        ]
