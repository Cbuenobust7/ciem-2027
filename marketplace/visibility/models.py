from django.conf import settings
from django.db import models
from django.utils import timezone


class City(models.Model):
    """
    Ciudades soportadas para zonas premium.
    """

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Ej. Lima, Arequipa, Trujillo.",
    )
    slug = models.SlugField(max_length=100, unique=True)
    premium_slots_count = models.PositiveSmallIntegerField(
        default=10,
        help_text="Número de posiciones en la Zona Premium (Top N).",
    )
    duration_days = models.PositiveSmallIntegerField(
        default=30,
        help_text="Duración del espacio premium en días.",
    )
    price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0,
        help_text=(
            "Precio plano por posición premium en esta ciudad "
            "(ignorado mientras is_promo_mode esté activo)."
        ),
    )
    currency = models.CharField(
        max_length=3,
        choices=[("PEN", "Soles (PEN)"), ("USD", "Dólares (USD)")],
        default="PEN",
    )
    is_promo_mode = models.BooleanField(
        default=True,
        help_text=(
            "Mientras esté activo, los vendedores pueden reclamar "
            "un espacio disponible GRATIS."
        ),
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Ciudad"
        verbose_name_plural = "Ciudades"

    def __str__(self):
        return self.name


class VisibilityPurchaseManager(models.Manager):
    """Manager para queries de compras activas."""

    def active_for_city(self, city):
        now = timezone.now()
        return self.filter(
            city=city,
            status=VisibilityPurchase.Status.PAID,
            starts_at__lte=now,
            ends_at__gt=now,
        )

    def occupied_positions(self, city):
        return set(
            self.active_for_city(city).values_list("position", flat=True)
        )


class VisibilityPurchase(models.Model):
    """
    Una compra de espacio premium para un vendedor en una ciudad
    y posición específica, durante un rango de fechas.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente de pago"
        PAID = "PAID", "Pagado"
        EXPIRED = "EXPIRED", "Expirado"
        CANCELLED = "CANCELLED", "Cancelado"

    class Currency(models.TextChoices):
        PEN = "PEN", "Soles (PEN)"
        USD = "USD", "Dólares (USD)"

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="visibility_purchases",
    )
    city = models.ForeignKey(
        City,
        on_delete=models.PROTECT,
        related_name="purchases",
    )
    position = models.PositiveSmallIntegerField(
        help_text="Posición dentro de la Zona Premium (1 = más alta).",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    currency = models.CharField(
        max_length=3,
        choices=Currency.choices,
        default=Currency.PEN,
    )
    is_promo = models.BooleanField(
        default=False,
        help_text="True si se reclamó gratis durante el modo promoción.",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    # MercadoPago
    mp_preference_id = models.CharField(max_length=120, blank=True)
    mp_order_id = models.CharField(max_length=120, blank=True)
    payment = models.ForeignKey(
        "payments_core.Payment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="visibility_purchases",
    )

    # ADR-10: la promoción pertenece a la cuenta de proveedor, no solo al
    # `seller` legado. Nullable para no romper las compras existentes; la
    # data-migration posterior rellena lo que se pueda mapear por `seller`.
    provider_account = models.ForeignKey(
        'cleaning_providers.ProviderAccount',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visibility_purchases',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = VisibilityPurchaseManager()

    class Meta:
        ordering = ["city", "position", "-created_at"]
        verbose_name = "Compra de visibilidad"
        verbose_name_plural = "Compras de visibilidad"

    def __str__(self):
        return (
            f"{self.seller.username} — {self.city.name} "
            f"#{self.position} ({self.status})"
        )

    @property
    def is_currently_active(self):
        now = timezone.now()
        return (
            self.status == self.Status.PAID
            and self.starts_at <= now <= self.ends_at
        )

    def activate(self):
        """Marca la compra como pagada y activa."""
        now = timezone.now()
        self.status = self.Status.PAID
        self.starts_at = now
        self.ends_at = now + timezone.timedelta(days=self.city.duration_days)
        self.save(update_fields=["status", "starts_at", "ends_at", "payment", "updated_at"])