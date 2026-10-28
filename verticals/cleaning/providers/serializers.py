from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from marketplace.categories.models import Category
from verticals.cleaning.availability.models import (
    AvailabilityException,
    AvailabilityRule,
)
from verticals.cleaning.services.models import ServiceDetails

from .models import (
    DirectoryCorrectionRequest,
    ProviderAccount,
    ProviderClaim,
    ProviderMembership,
    ProviderResource,
    ProviderServiceArea,
    ProviderStatusEvent,
)
from .permissions import staff_membership_exists

User = get_user_model()

TERMS_VERSION = '2026-10'


class ProviderServiceAreaSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = ProviderServiceArea
        fields = ['id', 'city', 'city_name', 'district', 'district_label', 'extra_fee']
        read_only_fields = ['id', 'city_name']

    def validate_district(self, value):
        return value.strip().lower()

    def validate_district_label(self, value):
        return value.strip()


class ProviderServiceSummarySerializer(serializers.ModelSerializer):
    status = serializers.CharField(source='listing.status', read_only=True)
    rejection_reason = serializers.CharField(source='listing.rejection_reason', read_only=True)
    listing_id = serializers.IntegerField(read_only=True)
    title = serializers.CharField(source='listing.title', read_only=True)
    price = serializers.DecimalField(source='listing.price', max_digits=10, decimal_places=2, read_only=True)
    currency = serializers.CharField(source='listing.currency', read_only=True)
    category = serializers.IntegerField(source='listing.category_id', read_only=True)

    class Meta:
        model = ServiceDetails
        fields = ['listing_id', 'title', 'price', 'currency', 'category', 'status', 'rejection_reason', 'duration_minutes', 'is_active']


class ProviderCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']


class ProviderPublicSerializer(serializers.ModelSerializer):
    service_areas = ProviderServiceAreaSerializer(many=True, read_only=True)
    service_categories = ProviderCategorySerializer(many=True, read_only=True)
    logo = serializers.SerializerMethodField()
    services = serializers.SerializerMethodField()
    is_informative = serializers.SerializerMethodField()
    can_book = serializers.SerializerMethodField()

    class Meta:
        model = ProviderAccount
        fields = [
            'id', 'display_name', 'slug', 'kind', 'description', 'logo', 'phone',
            'contact_email', 'address', 'website', 'whatsapp', 'instagram',
            'facebook', 'timezone', 'participation_status', 'verification_status',
            'is_published', 'is_informative', 'can_book', 'rating_avg',
            'rating_count', 'services_summary', 'service_categories',
            'service_areas', 'services',
        ]

    def get_logo(self, account):
        # §2: solo se publican imágenes con autorización o licencia.
        if not account.media_authorized or not account.logo:
            return None
        request = self.context.get('request')
        url = account.logo.url
        return request.build_absolute_uri(url) if request else url

    def get_services(self, account):
        # Una ficha de directorio no tiene oferta operativa; sus servicios se
        # describen con `service_categories` + `services_summary`.
        if not account.can_operate:
            return []
        services = account.services.filter(
            is_active=True, listing__status='active',
        ).select_related('listing')
        return ProviderServiceSummarySerializer(services, many=True).data

    def get_is_informative(self, account):
        return account.is_directory

    def get_can_book(self, account):
        return account.is_bookable


class ProviderCreateSerializer(serializers.ModelSerializer):
    terms_accepted = serializers.BooleanField(write_only=True)

    class Meta:
        model = ProviderAccount
        fields = [
            'display_name', 'legal_name', 'tax_id', 'kind', 'description',
            'logo', 'phone', 'contact_email', 'address', 'website', 'whatsapp',
            'instagram', 'facebook', 'timezone', 'terms_accepted',
        ]

    def validate_terms_accepted(self, value):
        if not value:
            raise serializers.ValidationError(
                'Debes aceptar las condiciones de colaboración.',
            )
        return value

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop('terms_accepted', None)
        account = ProviderAccount.objects.create(
            owner=self.context['request'].user,
            participation_status=ProviderAccount.Participation.PARTNER,
            is_published=True,
            terms_accepted_at=timezone.now(),
            terms_version=TERMS_VERSION,
            media_authorized=bool(validated_data.get('logo')),
            **validated_data,
        )
        ProviderMembership.objects.create(
            account=account,
            user=self.context['request'].user,
            role=ProviderMembership.Role.OWNER,
        )
        return account


class ProviderUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderAccount
        fields = [
            'display_name', 'legal_name', 'tax_id', 'kind', 'description',
            'logo', 'phone', 'contact_email', 'address', 'website', 'whatsapp',
            'instagram', 'facebook', 'timezone',
        ]

    def update(self, instance, validated_data):
        if validated_data.get('logo'):
            validated_data['media_authorized'] = True
        return super().update(instance, validated_data)


class ProviderDirectorySerializer(serializers.ModelSerializer):
    service_areas = ProviderServiceAreaSerializer(many=True, read_only=True)
    service_categories = ProviderCategorySerializer(many=True, read_only=True)
    logo = serializers.SerializerMethodField()
    is_informative = serializers.SerializerMethodField()
    can_book = serializers.SerializerMethodField()

    class Meta:
        model = ProviderAccount
        fields = [
            'id', 'display_name', 'slug', 'kind', 'description', 'logo',
            'participation_status', 'verification_status', 'is_informative',
            'can_book', 'rating_avg', 'rating_count', 'services_summary',
            'service_categories', 'service_areas',
        ]

    def get_logo(self, account):
        if not account.media_authorized or not account.logo:
            return None
        request = self.context.get('request')
        url = account.logo.url
        return request.build_absolute_uri(url) if request else url

    def get_is_informative(self, account):
        return account.is_directory

    def get_can_book(self, account):
        return account.is_bookable


class ProviderAdminSerializer(serializers.ModelSerializer):
    """Vista administrativa: incluye procedencia y campos internos."""

    owner_email = serializers.EmailField(source='owner.email', read_only=True)
    reviewed_by_email = serializers.EmailField(
        source='reviewed_by.email', read_only=True, default=None,
    )
    verified_by_email = serializers.EmailField(
        source='verified_by.email', read_only=True, default=None,
    )

    class Meta:
        model = ProviderAccount
        fields = [
            'id', 'display_name', 'slug', 'kind', 'owner', 'owner_email',
            'participation_status', 'verification_status', 'is_active',
            'is_published', 'verified_at', 'verified_by', 'verified_by_email',
            'source_name', 'source_url', 'source_retrieved_at',
            'last_reviewed_at', 'reviewed_by', 'reviewed_by_email',
            'internal_notes', 'media_authorized', 'media_source',
            'terms_accepted_at', 'terms_version', 'created_at', 'updated_at',
        ]
        read_only_fields = fields


class ProviderClaimCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderClaim
        fields = [
            'contact_email', 'contact_phone', 'message', 'evidence_url',
            'terms_accepted',
        ]

    def validate(self, attrs):
        if not attrs.get('contact_email') and not attrs.get('contact_phone'):
            raise serializers.ValidationError({
                'contact_email': 'Indica un email o un teléfono de contacto.',
            })
        if len((attrs.get('message') or '').strip()) < 20:
            raise serializers.ValidationError({
                'message': 'Explica brevemente tu relación con la empresa (mínimo 20 caracteres).',
            })
        if not attrs.get('terms_accepted'):
            raise serializers.ValidationError({
                'terms_accepted': 'Debes aceptar las condiciones de colaboración.',
            })
        return attrs


class ProviderClaimSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.display_name', read_only=True)
    claimant_email = serializers.EmailField(source='claimant.email', read_only=True)
    reviewed_by_email = serializers.EmailField(
        source='reviewed_by.email', read_only=True, default=None,
    )

    class Meta:
        model = ProviderClaim
        fields = [
            'id', 'account', 'account_name', 'claimant', 'claimant_email',
            'status', 'contact_email', 'contact_phone', 'message',
            'evidence_url', 'terms_accepted', 'created_at', 'reviewed_by',
            'reviewed_by_email', 'reviewed_at', 'decision_note',
        ]
        read_only_fields = fields


class ProviderCorrectionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectoryCorrectionRequest
        fields = [
            'kind', 'requester_name', 'requester_email', 'requester_phone',
            'message',
        ]

    def validate_message(self, value):
        if len((value or '').strip()) < 20:
            raise serializers.ValidationError(
                'Describe la corrección o retirada (mínimo 20 caracteres).',
            )
        return value


class ProviderCorrectionSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.display_name', read_only=True)
    resolved_by_email = serializers.EmailField(
        source='resolved_by.email', read_only=True, default=None,
    )

    class Meta:
        model = DirectoryCorrectionRequest
        fields = [
            'id', 'account', 'account_name', 'kind', 'requester_name',
            'requester_email', 'requester_phone', 'message', 'status',
            'created_at', 'resolved_by', 'resolved_by_email', 'resolved_at',
            'resolution_note',
        ]
        read_only_fields = fields


class ProviderStatusEventSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(
        source='actor.email', read_only=True, default=None,
    )

    class Meta:
        model = ProviderStatusEvent
        fields = [
            'id', 'account', 'event_type', 'from_status', 'to_status',
            'actor', 'actor_email', 'reason', 'metadata', 'created_at',
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Recursos y agenda (§5.1)
# ---------------------------------------------------------------------------
class ProviderResourceSerializer(serializers.ModelSerializer):
    """Recurso de agenda: persona, cuadrilla o equipo (§3.1)."""

    members = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), many=True, required=False,
    )

    class Meta:
        model = ProviderResource
        fields = ['id', 'name', 'kind', 'timezone', 'capacity', 'is_active', 'members']
        read_only_fields = ['id']

    def validate_name(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('El nombre del recurso es obligatorio.')
        return value

    def validate_members(self, users):
        """§3.1: cada miembro necesita una membership `staff` activa de la cuenta."""
        account = self.context['account']
        for user in users:
            if not staff_membership_exists(account, user):
                raise serializers.ValidationError(
                    f'{user.username} no tiene una membership "staff" activa en esta cuenta.',
                )
        return users

    def validate(self, attrs):
        account = self.context['account']
        name = attrs.get('name')
        if name:
            duplicate = ProviderResource.objects.filter(account=account, name=name)
            if self.instance is not None:
                duplicate = duplicate.exclude(pk=self.instance.pk)
            if duplicate.exists():
                raise serializers.ValidationError({
                    'name': 'Ya existe un recurso con ese nombre en esta cuenta.',
                })
        return attrs


class AvailabilityRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilityRule
        fields = [
            'id', 'weekday', 'start_time', 'end_time',
            'valid_from', 'valid_to', 'is_active',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        def value(field):
            if field in attrs:
                return attrs[field]
            return getattr(self.instance, field, None)

        start, end = value('start_time'), value('end_time')
        if start and end and end <= start:
            raise serializers.ValidationError({
                'end_time': 'La hora de fin debe ser posterior a la de inicio.',
            })
        valid_from, valid_to = value('valid_from'), value('valid_to')
        if valid_from and valid_to and valid_to < valid_from:
            raise serializers.ValidationError({
                'valid_to': 'La fecha final no puede ser anterior a la inicial.',
            })
        return attrs


class AvailabilityExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilityException
        fields = ['id', 'kind', 'starts_at', 'ends_at', 'reason']
        read_only_fields = ['id']

    def validate(self, attrs):
        def value(field):
            if field in attrs:
                return attrs[field]
            return getattr(self.instance, field, None)

        starts, ends = value('starts_at'), value('ends_at')
        if starts and ends and ends <= starts:
            raise serializers.ValidationError({
                'ends_at': 'El fin debe ser posterior al inicio.',
            })
        return attrs


class ResourceScheduleSerializer(serializers.Serializer):
    """Agenda de un recurso: reglas semanales + excepciones (§5.1).

    `PUT` es un reemplazo completo: lo que no venga en la petición, deja de
    existir. Es la semántica que espera un editor de agenda.
    """

    rules = AvailabilityRuleSerializer(many=True)
    exceptions = AvailabilityExceptionSerializer(many=True, required=False)

    def to_representation(self, instance):
        return {
            'resource': instance['resource'].pk,
            'resource_name': instance['resource'].name,
            'rules': AvailabilityRuleSerializer(instance['rules'], many=True).data,
            'exceptions': AvailabilityExceptionSerializer(
                instance['exceptions'], many=True,
            ).data,
        }


class ProviderMembershipSerializer(serializers.ModelSerializer):
    """Miembro de la cuenta y su rol (ADR-11)."""

    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = ProviderMembership
        fields = ['id', 'user', 'username', 'email', 'role', 'is_active', 'created_at']
        read_only_fields = ['id', 'username', 'email', 'created_at']
