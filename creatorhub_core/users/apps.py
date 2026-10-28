from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'creatorhub_core.users'
    label = 'creatorhub_users'
    verbose_name = 'CreatorHub Users'
