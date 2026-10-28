from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from marketplace.categories.models import Category
from verticals.cleaning.availability.models import (
    AvailabilityException,
    AvailabilityRule,
)
from verticals.cleaning.errors import (
    ForbiddenRole,
    InvalidPayload,
    ProviderNotOperational,
    ResourceNotFound,
)
from verticals.cleaning.services.models import ServiceDetails

from . import services as provider_services
from .models import (
    DirectoryCorrectionRequest,
    ProviderAccount,
    ProviderClaim,
    ProviderMembership,
    ProviderResource,
    ProviderServiceArea,
    ProviderStatusEvent,
)
from .permissions import (
    can_manage_provider,
    can_manage_resource,
    is_provider_owner,
)
from .serializers import (
    ProviderAdminSerializer,
    ProviderClaimCreateSerializer,
    ProviderClaimSerializer,
    ProviderCorrectionCreateSerializer,
    ProviderCorrectionSerializer,
    ProviderCreateSerializer,
    ProviderDirectorySerializer,
    ProviderMembershipSerializer,
    ProviderPublicSerializer,
    ProviderResourceSerializer,
    ProviderServiceAreaSerializer,
    ProviderServiceSummarySerializer,
    ProviderStatusEventSerializer,
    ProviderUpdateSerializer,
    ResourceScheduleSerializer,
)

User = get_user_model()

MANAGER_ROLES = (ProviderMembership.Role.OWNER, ProviderMembership.Role.ADMIN)


def provider_or_404(pk):
    return get_object_or_404(ProviderAccount, pk=pk)


def public_provider_queryset():
    """Fichas y asociados que pueden verse sin sesión (§2, §4)."""
    return (
        ProviderAccount.objects
        .filter(
            is_active=True,
            is_published=True,
            participation_status__in=ProviderAccount.PUBLIC_PARTICIPATION,
        )
        .exclude(verification_status=ProviderAccount.Verification.REJECTED)
    )


def visible_provider_queryset(user):
    """Público + las cuentas propias para que el panel no se rompa."""
    if user is not None and user.is_authenticated:
        if user.is_staff:
            return ProviderAccount.objects.filter(is_active=True)
        public = (
            Q(
                is_published=True,
                participation_status__in=ProviderAccount.PUBLIC_PARTICIPATION,
            )
            & ~Q(verification_status=ProviderAccount.Verification.REJECTED)
        )
        return (
            ProviderAccount.objects
            .filter(is_active=True)
            .filter(
                public
                | Q(owner=user)
                | Q(memberships__user=user)
            )
            .distinct()
        )
    return public_provider_queryset()


def require_operating(account):
    if not account.can_operate:
        raise ProviderNotOperational(
            'Esta ficha no tiene operativa habilitada.',
            extra={
                'account': account.id,
                'status': account.participation_status,
            },
        )


def _filter_by_category(queryset, slug):
    """Filtra por categoría de servicio, sea ficha o proveedor operativo."""
    category = get_object_or_404(Category, slug=slug, is_active=True)
    category_ids = [category.id]
    category_ids += list(
        category.children.filter(is_active=True).values_list('id', flat=True),
    )
    return queryset.filter(
        Q(service_categories__id__in=category_ids)
        | Q(
            services__listing__category_id__in=category_ids,
            services__is_active=True,
            services__listing__status='active',
        )
    )


class ProviderListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = public_provider_queryset()
        params = self.request.query_params

        text = (params.get('q') or '').strip()
        if text:
            qs = qs.filter(
                Q(display_name__icontains=text)
                | Q(description__icontains=text)
                | Q(services_summary__icontains=text)
            )

        modality = params.get('modality')
        if modality == 'directory':
            qs = qs.filter(
                participation_status__in=(
                    ProviderAccount.Participation.DIRECTORY,
                    ProviderAccount.Participation.CLAIMED,
                ),
            )
        elif modality == 'partners':
            qs = qs.filter(
                participation_status__in=(
                    ProviderAccount.Participation.PARTNER,
                    ProviderAccount.Participation.VERIFIED_PARTNER,
                ),
            )

        if params.get('city'):
            qs = qs.filter(service_areas__city_id=params['city'])
        if params.get('district'):
            qs = qs.filter(
                service_areas__district=params['district'].strip().lower(),
            )
        if params.get('kind'):
            qs = qs.filter(kind=params['kind'])
        if params.get('min_rating'):
            qs = qs.filter(rating_avg__gte=params['min_rating'])
        category = params.get('service_category') or params.get('category')
        if category:
            qs = _filter_by_category(qs, category)

        ordering = params.get('ordering')
        if ordering in {
            'display_name', '-display_name', 'rating_avg', '-rating_avg',
            'rating_count', '-rating_count', 'created_at', '-created_at',
        }:
            qs = qs.order_by(ordering)
        if not ordering:
            qs = qs.order_by('id')
        return qs.distinct().prefetch_related(
            'service_areas', 'service_categories', 'services__listing',
        )

    def get_serializer_class(self):
        return (
            ProviderCreateSerializer
            if self.request.method == 'POST'
            else ProviderDirectorySerializer
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = serializer.save()
        return Response(
            ProviderPublicSerializer(account, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class ProviderDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return visible_provider_queryset(self.request.user).prefetch_related(
            'service_areas', 'service_categories', 'services__listing',
        )

    def get_serializer_class(self):
        return (
            ProviderUpdateSerializer
            if self.request.method in {'PUT', 'PATCH'}
            else ProviderPublicSerializer
        )

    def update(self, request, *args, **kwargs):
        account = self.get_object()
        if not can_manage_provider(request.user, account):
            return Response(
                {'detail': 'forbidden_role'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if account.is_directory and not request.user.is_staff:
            raise ProviderNotOperational(
                'Una ficha de directorio solo la edita la plataforma.',
                extra={'account': account.id},
            )
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(
            account, data=request.data, partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        changed = sorted(serializer.validated_data.keys())
        account = serializer.save()
        provider_services.record_event(
            account,
            ProviderStatusEvent.EventType.PROFILE,
            actor=request.user,
            reason='perfil_actualizado',
            metadata={'fields': changed},
        )
        return Response(
            ProviderPublicSerializer(
                account, context={'request': request},
            ).data,
        )


class ProviderServicesView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ProviderServiceSummarySerializer

    def get_queryset(self):
        account = get_object_or_404(
            public_provider_queryset(),
            pk=self.kwargs['pk'],
        )
        # Las fichas de directorio no tienen oferta operativa: sus servicios
        # viajan en la ficha (`service_categories` + `services_summary`).
        if not account.can_operate:
            return ServiceDetails.objects.none()
        return ServiceDetails.objects.filter(
            provider_account=account, is_active=True, listing__status='active',
        ).select_related('listing').order_by('listing__title', 'pk')


class ProviderManagedServicesView(generics.ListAPIView):
    """Listado privado para el panel: incluye borradores y rechazos."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProviderServiceSummarySerializer

    def get_queryset(self):
        account = get_object_or_404(ProviderAccount, pk=self.kwargs['pk'])
        if not can_manage_provider(self.request.user, account):
            raise PermissionDenied('Solo owner o admin pueden ver los servicios internos.')
        require_operating(account)
        return ServiceDetails.objects.filter(
            provider_account=account, is_active=True,
        ).select_related('listing').order_by('listing__title', 'pk')


class ProviderServiceAreaListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProviderServiceAreaSerializer

    def get_account(self):
        return get_object_or_404(ProviderAccount, pk=self.kwargs['pk'])

    def get_queryset(self):
        return ProviderServiceArea.objects.filter(
            account=self.get_account(), is_active=True,
        ).select_related('city').order_by('city__name', 'district')

    def list(self, request, *args, **kwargs):
        account = self.get_account()
        if not can_manage_provider(request.user, account):
            return Response({'detail': 'forbidden_role'}, status=status.HTTP_403_FORBIDDEN)
        require_operating(account)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        account = self.get_account()
        if not can_manage_provider(request.user, account):
            return Response({'detail': 'forbidden_role'}, status=status.HTTP_403_FORBIDDEN)
        require_operating(account)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(account=account)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProviderServiceAreaDeleteView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk, area_id):
        account = get_object_or_404(ProviderAccount, pk=pk)
        if not can_manage_provider(request.user, account):
            return Response({'detail': 'forbidden_role'}, status=status.HTTP_403_FORBIDDEN)
        require_operating(account)
        area = get_object_or_404(ProviderServiceArea, pk=area_id, account=account)
        area.is_active = False
        area.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Recursos y agenda (§5.1)
# ---------------------------------------------------------------------------
class ProviderResourceListCreateView(generics.ListCreateAPIView):
    """`GET`/`POST /api/cleaning/providers/{pk}/resources/`.

    Crear un recurso es gestión comercial (`owner`/`admin`, §6.1); listarlos
    incluye al `staff`, que necesita saber qué agendas puede atender.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProviderResourceSerializer

    def get_account(self):
        return provider_or_404(self.kwargs['pk'])

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['account'] = self.get_account()
        return context

    def get_queryset(self):
        account = self.get_account()
        if not can_manage_resource(self.request.user, account):
            raise ForbiddenRole(
                'No eres miembro de esta cuenta.', extra={'account': account.id},
            )
        require_operating(account)
        queryset = ProviderResource.objects.filter(account=account)
        if not can_manage_provider(self.request.user, account):
            # El `staff` solo ve los recursos donde está asignado (§6.4).
            queryset = queryset.filter(members=self.request.user)
        return queryset.prefetch_related('members').order_by('id')

    def create(self, request, *args, **kwargs):
        account = self.get_account()
        if not can_manage_provider(request.user, account):
            raise ForbiddenRole(
                'Solo el dueño o un administrador pueden añadir recursos.',
                extra={'account': account.id},
            )
        require_operating(account)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        members = serializer.validated_data.pop('members', [])
        resource = serializer.save(account=account)
        if members:
            resource.members.set(members)
        return Response(
            self.get_serializer(resource).data, status=status.HTTP_201_CREATED,
        )


class ResourceScheduleView(APIView):
    """`GET`/`PUT /api/cleaning/providers/{pk}/resources/{rid}/schedule/`.

    Reglas semanales + excepciones de un recurso. El `staff` solo puede tocar la
    agenda de los recursos que tiene asignados (§6.1); `owner`/`admin`, todas.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, rid):
        account, resource = self._resolve(request, pk, rid)
        return Response(ResourceScheduleSerializer(self._payload(resource)).data)

    def put(self, request, pk, rid):
        account, resource = self._resolve(request, pk, rid)
        serializer = ResourceScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            # PUT es un reemplazo completo de la agenda de ese recurso.
            AvailabilityRule.objects.filter(resource=resource).delete()
            AvailabilityException.objects.filter(resource=resource).delete()
            for rule in data['rules']:
                AvailabilityRule.objects.create(resource=resource, **rule)
            for exception in data.get('exceptions', []):
                AvailabilityException.objects.create(
                    resource=resource, created_by=request.user, **exception,
                )
        return Response(ResourceScheduleSerializer(self._payload(resource)).data)

    def _resolve(self, request, pk, rid):
        account = provider_or_404(pk)
        resource = get_object_or_404(
            ProviderResource.objects.filter(account=account), pk=rid,
        )
        if not can_manage_resource(request.user, account, resource):
            raise ForbiddenRole(
                'No puedes gestionar la agenda de ese recurso.',
                extra={'account': account.id, 'resource': resource.id},
            )
        require_operating(account)
        return account, resource

    def _payload(self, resource):
        return {
            'resource': resource,
            'rules': list(resource.availability_rules.order_by('weekday', 'start_time')),
            'exceptions': list(
                resource.availability_exceptions.order_by('starts_at'),
            ),
        }


class ProviderMembersView(APIView):
    """`POST`/`DELETE /api/cleaning/providers/{pk}/members/` (§5.1).

    `owner`/`admin` gestionan miembros. Cambiar la **titularidad** (rol `owner`)
    es solo del titular o de la plataforma, y actualiza en una transacción la
    membership y `ProviderAccount.owner` (ADR-11); la señal posterior reasigna el
    `seller` de los anuncios para no romper la invariante de §6.3.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        account = provider_or_404(pk)
        if not can_manage_provider(request.user, account):
            raise ForbiddenRole(
                'Solo el dueño o un administrador pueden gestionar miembros.',
                extra={'account': account.id},
            )
        serializer = ProviderMembershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        role = serializer.validated_data.get('role', ProviderMembership.Role.STAFF)

        if role == ProviderMembership.Role.OWNER and not is_provider_owner(request.user, account):
            raise ForbiddenRole(
                'Solo el titular actual (o la plataforma) puede cambiar la titularidad.',
                extra={'account': account.id},
            )

        with transaction.atomic():
            if role == ProviderMembership.Role.OWNER:
                # ADR-11: `account.owner` y la membership `owner` cambian juntos.
                # El constraint `unique_active_provider_owner` obliga a desactivar
                # al titular anterior antes de activar al nuevo.
                ProviderMembership.objects.filter(
                    account=account, role=ProviderMembership.Role.OWNER,
                ).exclude(user=user).update(is_active=False)
            membership, created = ProviderMembership.objects.update_or_create(
                account=account,
                user=user,
                defaults={
                    'role': role,
                    'is_active': serializer.validated_data.get('is_active', True),
                },
            )
            if role == ProviderMembership.Role.OWNER and account.owner_id != user.id:
                account.owner = user
                account.save(update_fields=['owner', 'updated_at'])

        return Response(
            ProviderMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        account = provider_or_404(pk)
        if not can_manage_provider(request.user, account):
            raise ForbiddenRole(
                'Solo el dueño o un administrador pueden gestionar miembros.',
                extra={'account': account.id},
            )
        raw = request.data.get('user') or request.query_params.get('user')
        if not raw:
            raise InvalidPayload(
                'Indica el usuario a retirar en "user" (cuerpo o query).',
                extra={'param': 'user'},
            )
        if not str(raw).isdigit():
            raise InvalidPayload(
                'El parámetro "user" debe ser un identificador numérico.',
                extra={'param': 'user', 'value': raw},
            )
        membership = ProviderMembership.objects.filter(
            account=account, user_id=int(raw),
        ).first()
        if membership is None:
            raise ResourceNotFound(
                'Ese usuario no es miembro de la cuenta.',
                extra={'account': account.id, 'user': raw},
            )
        if membership.role == ProviderMembership.Role.OWNER:
            # La titularidad no se borra: se transfiere (ADR-11).
            raise ForbiddenRole(
                'La titularidad no se puede retirar; transfiérela a otro miembro.',
                extra={'account': account.id, 'user': raw},
            )
        # Baja lógica: el historial de quién operó la cuenta se conserva.
        membership.is_active = False
        membership.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProviderRequestVerificationView(generics.GenericAPIView):
    """Solicita (o vuelve a solicitar) la verificación de la cuenta.

    Contrato:
      * `rejected` → `pending` (y se limpia `verified_at`)
      * `pending` / `verified` → 200 idempotente, sin cambios
      * `suspended` → 403 `provider_suspended`
      * cuenta inactiva → 403 `provider_inactive`
      * ficha de directorio → 403 `provider_not_operational`
      * solo `owner`/`admin` de la cuenta (`can_manage_provider`)

    Nota: a diferencia de `ProviderDetailView`, el queryset **no excluye las
    cuentas rechazadas**: son precisamente las que pueden volver a pedir la
    verificación. La reclamación de ficha no verifica: este endpoint solo cambia
    el subestado documental.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ProviderAccount.objects.all()

    def post(self, request, pk):
        account = self.get_object()
        if not can_manage_provider(request.user, account):
            raise ForbiddenRole(
                'Solo el dueño o un administrador pueden solicitar la verificación.',
                extra={'account': account.id},
            )
        account = provider_services.request_verification(account, request.user)
        return Response(
            ProviderPublicSerializer(account, context={'request': request}).data,
        )


# ---------------------------------------------------------------------------
# Reclamaciones y correcciones (§2, §8)
# ---------------------------------------------------------------------------
class ProviderClaimView(APIView):
    """`POST /api/cleaning/providers/{pk}/claim/` — reclamar una ficha."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        account = get_object_or_404(
            ProviderAccount,
            pk=pk,
            is_active=True,
            is_published=True,
        )
        serializer = ProviderClaimCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claim = provider_services.request_claim(
            account,
            request.user,
            **serializer.validated_data,
        )
        return Response(
            ProviderClaimSerializer(claim).data,
            status=status.HTTP_201_CREATED,
        )


class ProviderCorrectionView(APIView):
    """`POST /api/cleaning/providers/{pk}/corrections/` — corrección o retirada.

    Es público (no exige cuenta) y está limitado por tasa para evitar abuso.
    No modifica la ficha: la resolución la hace un administrador.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'corrections'

    def post(self, request, pk):
        account = get_object_or_404(
            ProviderAccount,
            pk=pk,
            is_active=True,
        )
        serializer = ProviderCorrectionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        correction = DirectoryCorrectionRequest.objects.create(
            account=account,
            **serializer.validated_data,
        )
        provider_services.record_event(
            account,
            ProviderStatusEvent.EventType.CORRECTION,
            actor=request.user if request.user.is_authenticated else None,
            reason='solicitud_recibida',
            metadata={
                'correction_request': correction.id,
                'kind': correction.kind,
            },
        )
        return Response(
            ProviderCorrectionSerializer(correction).data,
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Administración (§5, §8)
# ---------------------------------------------------------------------------
class ProviderAdminProviderListView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = ProviderAdminSerializer

    def get_queryset(self):
        qs = ProviderAccount.objects.select_related(
            'owner', 'reviewed_by', 'verified_by',
        )
        params = self.request.query_params
        if params.get('status'):
            qs = qs.filter(participation_status=params['status'])
        if params.get('published') in {'true', 'false'}:
            qs = qs.filter(is_published=params['published'] == 'true')
        text = (params.get('q') or '').strip()
        if text:
            qs = qs.filter(
                Q(display_name__icontains=text)
                | Q(legal_name__icontains=text)
                | Q(contact_email__icontains=text),
            )
        return qs.order_by('-updated_at')


class ProviderAdminPublishView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        account = get_object_or_404(ProviderAccount, pk=pk)
        value = request.data.get('is_published')
        if not isinstance(value, bool):
            raise InvalidPayload(
                'El campo "is_published" debe ser booleano.',
                extra={'param': 'is_published'},
            )
        account = provider_services.set_publication(
            account,
            request.user,
            value,
            reason=request.data.get('reason', ''),
        )
        return Response(ProviderAdminSerializer(account).data)


class ProviderAdminClaimListView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = ProviderClaimSerializer

    def get_queryset(self):
        qs = ProviderClaim.objects.select_related(
            'account', 'claimant', 'reviewed_by',
        )
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by('-created_at')


class ProviderAdminClaimActionView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk, action):
        claim = get_object_or_404(ProviderClaim, pk=pk)
        note = request.data.get('decision_note', '')
        if action == 'approve':
            claim = provider_services.approve_claim(claim, request.user, note)
        elif action == 'reject':
            claim = provider_services.reject_claim(claim, request.user, note)
        else:
            raise ResourceNotFound(
                'Acción de reclamación desconocida.',
                extra={'action': action},
            )
        return Response(ProviderClaimSerializer(claim).data)


class ProviderAdminCorrectionListView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = ProviderCorrectionSerializer

    def get_queryset(self):
        qs = DirectoryCorrectionRequest.objects.select_related(
            'account', 'resolved_by',
        )
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by('-created_at')


class ProviderAdminCorrectionActionView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk, action):
        correction = get_object_or_404(DirectoryCorrectionRequest, pk=pk)
        note = request.data.get('resolution_note', '')
        if action == 'resolve':
            remove = request.data.get('remove')
            if remove is None:
                remove = correction.kind == DirectoryCorrectionRequest.Kind.REMOVAL
            correction = provider_services.resolve_correction(
                correction, request.user, note=note, remove=bool(remove),
            )
        elif action == 'reject':
            correction = provider_services.reject_correction(
                correction, request.user, note=note,
            )
        else:
            raise ResourceNotFound(
                'Acción de corrección desconocida.',
                extra={'action': action},
            )
        return Response(ProviderCorrectionSerializer(correction).data)


class ProviderAdminAuditView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = ProviderStatusEventSerializer

    def get_queryset(self):
        qs = ProviderStatusEvent.objects.select_related('actor', 'account')
        account_id = self.request.query_params.get('account')
        if account_id:
            qs = qs.filter(account_id=account_id)
        return qs.order_by('-created_at')

