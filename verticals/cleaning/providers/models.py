"""Modelos de `cleaning_providers` — quién vende.

Especificación: docs/CLEANING_VERTICAL_TECHNICAL_PLAN.md §3.1 (ADR-01, ADR-07).
`ProviderAccount` es el tenant; `ProviderResource` es quien tiene agenda.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.text import slugify


class ProviderAccount(models.Model):
    """La entidad que vende, factura, aparece en el directorio y recibe reseñas."""

    class Kind(models.TextChoices):
        INDIVIDUAL = 'individual', 'Persona independiente'
        COMPANY = 'company', 'Empresa'

    class Verification(models.TextChoices):
        PENDING = 'pending', 'Pendiente'
        VERIFIED = 'verified', 'Verificada'
        REJECTED = 'rejected', 'Rechazada'
        SUSPENDED = 'suspended', 'Suspendida'

    class Participation(models.TextChoices):
        """Relación comercial con la plataforma (especificación §4).

        Es un eje distinto de `verification_status`: una ficha de directorio no
        tiene cuenta, y reclamarla no la verifica.
        """

        DIRECTORY = 'directory', 'Ficha de directorio'
        CLAIMED = 'claimed', 'Ficha reclamada'
        PARTNER = 'partner', 'Proveedor asociado'
        VERIFIED_PARTNER = 'verified_partner', 'Proveedor asociado verificado'
        SUSPENDED = 'suspended', 'Suspendida'
        REMOVED = 'removed', 'Retirada'

    #: Estados que pueden aparecer en el directorio público.
    PUBLIC_PARTICIPATION = ('directory', 'claimed', 'partner', 'verified_partner')
    #: Estados con operativa habilitada (servicios, agenda, reservas).
    OPERATING_PARTICIPATION = ('partner', 'verified_partner')

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='owned_provider_accounts',
    )
    display_name = models.CharField(max_length=120)
    legal_name = models.CharField(max_length=160, blank=True)
    tax_id = models.CharField(max_length=20, blank=True)
    # `blank=True` no está en la especificación: es necesario porque el propio
    # `save()` genera el slug cuando llega vacío (§3.1 "generado si viene vacío").
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    kind = models.CharField(
        max_length=12, choices=Kind.choices, default=Kind.INDIVIDUAL,
    )
    platform_fee_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
    )
    description = models.TextField(blank=True)
    logo = models.ImageField(
        upload_to='providers/logos/%Y/%m/', null=True, blank=True,
    )
    phone = models.CharField(max_length=20, blank=True)
    contact_email = models.EmailField(blank=True)
    # --- Datos comerciales de la ficha (§2) -------------------------------
    address = models.CharField(max_length=200, blank=True)
    website = models.URLField(max_length=300, blank=True)
    whatsapp = models.CharField(max_length=20, blank=True)
    instagram = models.URLField(max_length=300, blank=True)
    facebook = models.URLField(max_length=300, blank=True)
    services_summary = models.TextField(
        blank=True,
        help_text='Servicios declarados de una ficha sin cuenta operativa.',
    )
    service_categories = models.ManyToManyField(
        'marketplace_categories.Category',
        blank=True,
        related_name='directory_providers',
        help_text='Categorías de servicio para buscar fichas de directorio.',
    )
    timezone = models.CharField(max_length=64, default='America/Lima')
    participation_status = models.CharField(
        max_length=20,
        choices=Participation.choices,
        default=Participation.PARTNER,
        db_index=True,
    )
    verification_status = models.CharField(
        max_length=12, choices=Verification.choices, default=Verification.PENDING,
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    is_active = models.BooleanField(default=True)
    is_published = models.BooleanField(
        default=False,
        help_text='Publicación pública separada del estado de participación.',
    )
    # --- Procedencia y revisión (§2, §9) ---------------------------------
    source_name = models.CharField(max_length=120, blank=True)
    source_url = models.URLField(max_length=300, blank=True)
    source_retrieved_at = models.DateTimeField(null=True, blank=True)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    internal_notes = models.TextField(blank=True)
    media_authorized = models.BooleanField(default=False)
    media_source = models.CharField(max_length=200, blank=True)
    # --- Condiciones de colaboración (§3) --------------------------------
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    terms_version = models.CharField(max_length=20, blank=True)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    rating_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cuenta de proveedor'
        verbose_name_plural = 'Cuentas de proveedor'
        indexes = [
            models.Index(
                fields=['participation_status', 'is_published', 'is_active'],
            ),
            models.Index(fields=['verification_status', 'is_active']),
            models.Index(fields=['kind', 'is_active']),
            models.Index(fields=['owner']),
            models.Index(fields=['display_name']),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(rating_avg__gte=0) & Q(rating_avg__lte=5),
                name='provider_rating_avg_range',
            ),
            models.CheckConstraint(
                condition=Q(platform_fee_percent__isnull=True)
                | (Q(platform_fee_percent__gte=0) & Q(platform_fee_percent__lte=100)),
                name='provider_fee_percent_range',
            ),
            # §4: una ficha de directorio no tiene cuenta operativa.
            models.CheckConstraint(
                condition=(
                    ~Q(participation_status__in=['directory', 'claimed'])
                    | Q(owner__isnull=True)
                ),
                name='directory_provider_has_no_owner',
            ),
            # §4: un asociado (partner/verified_partner) siempre tiene titular.
            models.CheckConstraint(
                condition=(
                    ~Q(participation_status__in=['partner', 'verified_partner'])
                    | Q(owner__isnull=False)
                ),
                name='operating_provider_requires_owner',
            ),
            # §4: verified_partner implica verificación documental.
            models.CheckConstraint(
                condition=(
                    ~Q(participation_status='verified_partner')
                    | Q(verification_status='verified')
                ),
                name='verified_partner_requires_verified',
            ),
        ]

    def __str__(self):
        return self.display_name

    @property
    def is_directory(self):
        return self.participation_status in (
            self.Participation.DIRECTORY,
            self.Participation.CLAIMED,
        )

    @property
    def can_operate(self):
        """Puede gestionar servicios, zonas y agenda (§4, §5)."""
        return (
            self.is_active
            and self.participation_status in self.OPERATING_PARTICIPATION
        )

    @property
    def is_public(self):
        """Puede aparecer en el directorio público."""
        return (
            self.is_active
            and self.is_published
            and self.participation_status in self.PUBLIC_PARTICIPATION
        )

    @property
    def is_bookable(self):
        """Puede recibir reservas.

        Fase 2 conserva la regla vigente: cuenta operativa, publicada y
        verificada. La decisión D3 (partner también reservable) se aplica en la
        Fase 3 junto con la matriz de transiciones.
        """
        return (
            self.can_operate
            and self.is_published
            and self.verification_status == self.Verification.VERIFIED
        )

    def clean(self):
        """Coherencia entre relación, titular y verificación (§4)."""
        from django.core.exceptions import ValidationError

        errors = {}
        if (
            self.participation_status in self.OPERATING_PARTICIPATION
            and self.owner_id is None
        ):
            errors['owner'] = 'Un proveedor asociado necesita un titular.'
        if (
            self.participation_status in (
                self.Participation.DIRECTORY,
                self.Participation.CLAIMED,
            )
            and self.owner_id is not None
        ):
            errors['owner'] = 'Una ficha de directorio no puede tener titular.'
        if (
            self.participation_status == self.Participation.VERIFIED_PARTNER
            and self.verification_status != self.Verification.VERIFIED
        ):
            errors['verification_status'] = (
                'Un proveedor verificado necesita verification_status="verified".'
            )
        if self.is_published and not self.is_public:
            errors['is_published'] = (
                'Solo las fichas y proveedores activos pueden publicarse.'
            )
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.display_name)[:140] or 'proveedor'
            candidate, suffix = base, 2
            while (
                ProviderAccount.objects
                .exclude(pk=self.pk)
                .filter(slug=candidate)
                .exists()
            ):
                candidate = f'{base[:133]}-{suffix}'
                suffix += 1
            self.slug = candidate
        super().save(*args, **kwargs)


class ProviderMembership(models.Model):
    """Quién puede operar la cuenta y con qué rol. Fuente de verdad del acceso (ADR-11)."""

    class Role(models.TextChoices):
        OWNER = 'owner', 'Dueño'
        ADMIN = 'admin', 'Administrador'
        STAFF = 'staff', 'Personal'

    account = models.ForeignKey(
        ProviderAccount, on_delete=models.CASCADE, related_name='memberships',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='provider_memberships',
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STAFF)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Miembro de cuenta'
        verbose_name_plural = 'Miembros de cuenta'
        constraints = [
            models.UniqueConstraint(
                fields=['account', 'user'], name='unique_membership_account_user',
            ),
            models.UniqueConstraint(
                fields=['account'],
                condition=Q(role='owner', is_active=True),
                name='unique_active_provider_owner',
            ),
        ]
        indexes = [models.Index(fields=['user', 'is_active'])]

    def __str__(self):
        return f'{self.user} · {self.get_role_display()} · {self.account}'


class ProviderResource(models.Model):
    """Quien tiene agenda: persona, cuadrilla o máquina (ADR-01)."""

    class Kind(models.TextChoices):
        HUMAN = 'human', 'Persona'
        CREW = 'crew', 'Cuadrilla'
        MACHINE = 'machine', 'Equipo'

    account = models.ForeignKey(
        ProviderAccount, on_delete=models.CASCADE, related_name='resources',
    )
    name = models.CharField(max_length=80)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.CREW)
    timezone = models.CharField(max_length=64, blank=True)
    capacity = models.PositiveSmallIntegerField(default=1)
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name='cleaning_resources',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Recurso de proveedor'
        verbose_name_plural = 'Recursos de proveedor'
        constraints = [
            models.UniqueConstraint(
                fields=['account', 'name'], name='unique_resource_name_per_account',
            ),
        ]
        indexes = [models.Index(fields=['account', 'is_active'])]

    def __str__(self):
        return f'{self.account} · {self.name}'

    @property
    def effective_timezone(self):
        """La zona del recurso, o la de su cuenta si no define una (ADR-07)."""
        return self.timezone or self.account.timezone


class ProviderServiceArea(models.Model):
    """Dónde presta servicio la cuenta. Lima se organiza por distritos (§3.1)."""

    account = models.ForeignKey(
        ProviderAccount, on_delete=models.CASCADE, related_name='service_areas',
    )
    city = models.ForeignKey(
        'marketplace_visibility.City',
        on_delete=models.PROTECT,
        related_name='cleaning_areas',
    )
    district = models.CharField(max_length=80)
    district_label = models.CharField(max_length=80)
    extra_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Zona de cobertura'
        verbose_name_plural = 'Zonas de cobertura'
        constraints = [
            models.UniqueConstraint(
                fields=['account', 'city', 'district'], name='unique_area_per_account',
            ),
        ]
        indexes = [models.Index(fields=['city', 'district', 'is_active'])]

    def __str__(self):
        return f'{self.account} · {self.district_label}'


class ProviderClaim(models.Model):
    """Reclamación de una ficha de directorio (especificación §2, §4).

    Reclamar **no** verifica: la aprobación convierte la ficha en `partner` y
    asigna titularidad; la verificación es un acto administrativo posterior.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pendiente'
        APPROVED = 'approved', 'Aprobada'
        REJECTED = 'rejected', 'Rechazada'
        WITHDRAWN = 'withdrawn', 'Retirada'

    account = models.ForeignKey(
        ProviderAccount,
        on_delete=models.PROTECT,
        related_name='claims',
    )
    claimant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='provider_claims',
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING,
    )
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    message = models.TextField()
    evidence_url = models.URLField(max_length=300, blank=True)
    terms_accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Reclamación de ficha'
        verbose_name_plural = 'Reclamaciones de ficha'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['account'],
                condition=Q(status='pending'),
                name='unique_pending_claim_per_account',
            ),
        ]
        indexes = [
            models.Index(fields=['account', 'status']),
            models.Index(fields=['claimant', 'created_at']),
        ]

    def __str__(self):
        return f'{self.account} · {self.claimant} · {self.get_status_display()}'


class DirectoryCorrectionRequest(models.Model):
    """Corrección, reclamación de datos o retirada de una ficha (§2, §9)."""

    class Kind(models.TextChoices):
        CORRECTION = 'correction', 'Corrección de datos'
        REMOVAL = 'removal', 'Retirada de ficha'
        DATA_ISSUE = 'data_issue', 'Problema de datos'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pendiente'
        RESOLVED = 'resolved', 'Resuelta'
        REJECTED = 'rejected', 'Rechazada'

    account = models.ForeignKey(
        ProviderAccount,
        on_delete=models.PROTECT,
        related_name='correction_requests',
    )
    kind = models.CharField(max_length=12, choices=Kind.choices)
    requester_name = models.CharField(max_length=120)
    requester_email = models.EmailField()
    requester_phone = models.CharField(max_length=20, blank=True)
    message = models.TextField()
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Solicitud de corrección o retirada'
        verbose_name_plural = 'Solicitudes de corrección o retirada'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['account', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f'{self.account} · {self.get_kind_display()} · {self.get_status_display()}'


class ProviderStatusEvent(models.Model):
    """Auditoría administrativa de la empresa (§5).

    Mismo patrón que `BookingEvent`: quién, cuándo, de qué estado a cuál y por
    qué. No se escribe desde las vistas: lo hacen los servicios de dominio.
    """

    class EventType(models.TextChoices):
        STATUS = 'status', 'Estado de participación'
        VERIFICATION = 'verification', 'Verificación'
        CLAIM = 'claim', 'Reclamación'
        CORRECTION = 'correction', 'Corrección o retirada'
        TERMS = 'terms', 'Condiciones de colaboración'
        PROFILE = 'profile', 'Perfil comercial'
        PUBLICATION = 'publication', 'Publicación'

    account = models.ForeignKey(
        ProviderAccount,
        on_delete=models.PROTECT,
        related_name='status_events',
    )
    event_type = models.CharField(
        max_length=16, choices=EventType.choices, default=EventType.STATUS,
    )
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    reason = models.CharField(max_length=160, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Evento de proveedor'
        verbose_name_plural = 'Eventos de proveedor'
        ordering = ['created_at']
        indexes = [models.Index(fields=['account', 'created_at'])]

    def __str__(self):
        return f'{self.account_id}: {self.event_type} {self.from_status or "—"} → {self.to_status or "—"}'

