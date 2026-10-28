from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


class Review(models.Model):
    RATING_CHOICES = [(i, str(i)) for i in range(1, 6)]

    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews_written',
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews_received',
    )
    listing = models.ForeignKey(
        'marketplace_listings.Listing',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviews',
    )
    # ADR-09: la reseña verificada se ata a una reserva **completada** de la
    # vertical. `PROTECT` para que una reserva reseñada no se pueda borrar y
    # perder su comprobante; `null` para no romper las reseñas de producto.
    booking = models.ForeignKey(
        'cleaning_bookings.Booking',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='reviews',
        help_text='Reserva que verifica esta reseña (vertical de limpieza).',
    )
    # Lo deriva el servidor: nunca lo decide el cliente (ADR-09).
    is_verified = models.BooleanField(default=False)
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Reseña'
        verbose_name_plural = 'Reseñas'
        constraints = [
            models.UniqueConstraint(
                fields=['booking'],
                condition=Q(booking__isnull=False),
                name='unique_review_per_booking',
            ),
        ]
        indexes = [
            models.Index(fields=['seller', 'created_at']),
            models.Index(fields=['listing']),
            models.Index(fields=['reviewer']),
            models.Index(fields=['booking']),
        ]

    def __str__(self):
        return (
            f"{self.reviewer.username} → "
            f"{self.seller.username} ({self.rating}★)"
        )

    def save(self, *args, **kwargs):
        """`is_verified` se deriva de la reserva; el cliente no lo escribe."""
        if self.booking_id is not None:
            self.is_verified = self.booking.status == 'completed'
        else:
            self.is_verified = False
        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            kwargs['update_fields'] = set(update_fields) | {'is_verified'}
        super().save(*args, **kwargs)
