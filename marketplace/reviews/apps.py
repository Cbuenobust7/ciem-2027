from django.apps import AppConfig


class ReviewsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'marketplace.reviews'
    label = 'marketplace_reviews'
    verbose_name = 'Marketplace Starter Reviews'