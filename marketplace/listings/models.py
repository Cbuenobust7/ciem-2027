from django.conf import settings
from django.db import models
from django.utils import timezone


class Listing(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Borrador'),
        ('pending_review', 'Pendiente de revisión'),
        ('active', 'Activo'),
        ('rejected', 'Rechazado'),
        ('paused', 'Pausado'),
        ('sold', 'Vendido'),
        ('expired', 'Expirado'),
    )

    CONDITION_CHOICES = (
        ('new', 'Nuevo'),
        ('like_new', 'Como nuevo'),
        ('good', 'Buen estado'),
        ('fair', 'Estado aceptable'),
        ('for_parts', 'Para repuestos'),
    )

    CURRENCY_CHOICES = (
        ('PEN', 'Soles'),
        ('USD', 'Dólares'),
    )

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='listings'
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='PEN')
    is_negotiable = models.BooleanField(default=False)
    is_free = models.BooleanField(default=False)
    # NOTA: La FK a Category se añadirá cuando exista marketplace.categories
    category = models.ForeignKey(
         'marketplace_categories.Category',
         on_delete=models.SET_NULL,
         null=True,
         blank=True,
         related_name='listings'
     )
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='good')
    location = models.CharField(max_length=200, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    rejection_reason = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='reviewed_listings',
    )
    view_count = models.IntegerField(default=0)
    favorite_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['seller', 'status']),
            models.Index(fields=['location']),
            models.Index(fields=['price']),
        ]
        verbose_name = 'Anuncio'
        verbose_name_plural = 'Anuncios'

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

    def publish(self):
        self.status = 'active'
        self.published_at = timezone.now()
        self.save(update_fields=['status', 'published_at'])

    def submit_for_review(self):
        """Envía un servicio a moderación; nunca lo publica directamente."""
        if self.status not in {'draft', 'rejected'}:
            raise ValueError('Solo un borrador o servicio rechazado puede enviarse a revisión.')
        self.status = 'pending_review'
        self.rejection_reason = ''
        self.reviewed_at = None
        self.reviewed_by = None
        self.save(update_fields=['status', 'rejection_reason', 'reviewed_at', 'reviewed_by'])

    def approve(self, reviewer):
        self.status = 'active'
        self.rejection_reason = ''
        self.reviewed_at = timezone.now()
        self.reviewed_by = reviewer
        self.published_at = self.published_at or self.reviewed_at
        self.save(update_fields=['status', 'rejection_reason', 'reviewed_at', 'reviewed_by', 'published_at'])

    def reject(self, reviewer, reason):
        self.status = 'rejected'
        self.rejection_reason = reason
        self.reviewed_at = timezone.now()
        self.reviewed_by = reviewer
        self.save(update_fields=['status', 'rejection_reason', 'reviewed_at', 'reviewed_by'])

    def mark_as_sold(self):
        self.status = 'sold'
        self.save(update_fields=['status'])

    def can_be_edited_by(self, user):
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        return self.seller_id == user.id


class ListingImage(models.Model):
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='images'
    )
    image = models.ImageField(upload_to='listings/%Y/%m/%d/')
    alt_text = models.CharField(max_length=200, blank=True)
    order = models.IntegerField(default=0)
    is_cover = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = 'Imagen de anuncio'
        verbose_name_plural = 'Imágenes de anuncios'
        constraints = [
            models.UniqueConstraint(
                fields=['listing'],
                condition=models.Q(is_cover=True),
                name='unique_cover_per_listing',
            ),
        ]
        indexes = [
            models.Index(fields=['listing', 'order']),
        ]

    def __str__(self):
        return f"Imagen de {self.listing.title}"