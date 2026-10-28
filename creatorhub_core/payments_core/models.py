from django.conf import settings
from django.db import models


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        COMPLETED = "completed", "Completado"
        FAILED = "failed", "Fallido"
        REFUNDED = "refunded", "Reembolsado"

    class Currency(models.TextChoices):
        PEN = "PEN", "Soles"
        USD = "USD", "Dólares"

    payer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    currency = models.CharField(
        max_length=3,
        choices=Currency.choices,
        default=Currency.PEN,
    )

    # Libre: cada producto define sus propios tipos.
    payment_type = models.CharField(max_length=30)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    gateway = models.CharField(
        max_length=20,
        default="mercadopago",
    )

    gateway_payment_id = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        unique=True,
    )

    external_reference = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        db_index=True,
    )

    platform_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    raw_gateway_response = models.JSONField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["payer", "status"],
                name="payment_payer_status_idx",
            ),
            models.Index(
                fields=["created_at"],
                name="payment_created_at_idx",
            ),
        ]

    def __str__(self):
        return (
            f"Payment #{self.pk} — "
            f"{self.amount} {self.currency} — "
            f"{self.status}"
        )
