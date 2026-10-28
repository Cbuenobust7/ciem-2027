import os
from decimal import Decimal
from pathlib import Path
from decouple import Config, RepositoryEnv
from datetime import timedelta

# ============================================
# CONFIGURACIÓN INICIAL
# ============================================
BASE_DIR = Path(__file__).resolve().parent.parent

ENVIRONMENT = os.getenv("DJANGO_ENV", "development")

if ENVIRONMENT == "production":
    env_file = BASE_DIR / ".env.production"
else:
    env_file = BASE_DIR / ".env"

config = Config(RepositoryEnv(env_file))

BACKEND_URL = config('BACKEND_URL', default='http://localhost:8078')
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5190')
PLATFORM_NAME = config('PLATFORM_NAME', default='CREATORHUB')

# Checkout Pro (redirección). El fallback permite una migración gradual de
# instalaciones que aún conservan los nombres anteriores.
MERCADOPAGO_PRO_ACCESS_TOKEN = config(
    'MERCADOPAGO_PRO_ACCESS_TOKEN',
    default=config('MERCADOPAGO_ACCESS_TOKEN', default=''),
)
MERCADOPAGO_PRO_WEBHOOK_SECRET = config(
    'MERCADOPAGO_PRO_WEBHOOK_SECRET',
    default=config('MERCADOPAGO_WEBHOOK_SECRET', default=''),
)

# Exclusivo para crear la Order de prueba usada en la medición de calidad de
# Checkout Pro vía Orders. Nunca sustituye el token del flujo clásico.
MERCADOPAGO_CHECKOUT_PRO_TEST_ACCESS_TOKEN = config(
    'MERCADOPAGO_CHECKOUT_PRO_TEST_ACCESS_TOKEN',
    default='',
)

MERCADOPAGO_BRICKS_ACCESS_TOKEN = config(
    'MERCADOPAGO_BRICKS_ACCESS_TOKEN',
    default='',
)

MERCADOPAGO_BRICKS_WEBHOOK_SECRET = config(
    'MERCADOPAGO_BRICKS_WEBHOOK_SECRET',
    default='',
)

# Aliases temporales para código y pruebas de versiones anteriores.
MERCADOPAGO_ACCESS_TOKEN = MERCADOPAGO_PRO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET = MERCADOPAGO_PRO_WEBHOOK_SECRET

SECRET_KEY = config('SECRET_KEY', default='dev-secret-key-change-in-prod')
DEBUG_RAW = config('DEBUG', default='True')
DEBUG = str(DEBUG_RAW).lower() in ('true', '1', 'yes', 'on')
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',

    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'channels',

    'dj_rest_auth',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',

    'creatorhub_core.users',
    'marketplace.users',
    'marketplace.categories',
    'marketplace.listings',
    'marketplace.favorites',
    'marketplace.reviews',
    'creatorhub_core.payments_core',
    'marketplace.visibility'
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'core.urls'
WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'templates'],
    'APP_DIRS': True,
    'OPTIONS': {
        'context_processors': [
            'django.template.context_processors.debug',
            'django.template.context_processors.request',
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
        ],
    },
}]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='marketplace_starter'),
        'USER': config('DB_USER', default='marketplace_user'),
        'PASSWORD': config('DB_PASSWORD', default='change-this-local-password'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

AUTH_USER_MODEL = 'marketplace_users.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'es-pe'
TIME_ZONE = 'America/Lima'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_RATES': {
        # Formulario público de corrección/retirada (§2, §9).
        'corrections': '10/hour',
    },
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    # Contrato de error uniforme de la vertical (§5.2). El handler solo
    # reescribe las respuestas de las rutas /api/cleaning/.
    'EXCEPTION_HANDLER': 'verticals.cleaning.errors.cleaning_exception_handler',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# nginx termina TLS y transmite el esquema original al upstream.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default='',
).split(',') if config('CSRF_TRUSTED_ORIGINS', default='') else []

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5190,http://127.0.0.1:5190'
).split(',')

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [(config('REDIS_HOST', default='localhost'), config('REDIS_PORT', default=6379, cast=int))],
        },
    },
}

PLATFORM_FEE_PERCENT = 10.00

NOTIFICATION_EVENTS = [
    'listing_published',
    'listing_sold',
    'listing_favorited',
    'review_received',
    'promotion_purchased',
]

SITE_ID = 1

# dj-rest-auth: CreatorHub utiliza JWT, no tokens DRF clásicos.
REST_AUTH = {
    'USE_JWT': True,
    'TOKEN_MODEL': None,
}

# ============================================================
# USER SERIALIZER (configurable por producto)
# ============================================================
USER_SERIALIZER = 'marketplace.users.serializers.UserSerializer'

# ============================================================
# VERTICAL DE LIMPIEZA (verticals/cleaning)
# ============================================================
# Las apps siempre están instaladas para que Django cargue sus modelos y
# migraciones. El flag controla únicamente si se montan las rutas públicas.
# Ver docs/CLEANING_VERTICAL_TECHNICAL_PLAN.md (ADR-10).
CLEANING_VERTICAL_ENABLED = config('CLEANING_VERTICAL_ENABLED', default=False, cast=bool)

INSTALLED_APPS += [
    'verticals.cleaning.providers',
    'verticals.cleaning.services',
    'verticals.cleaning.availability',
    'verticals.cleaning.bookings',
]

# Duración del bloqueo `requested` (ADR-06).
BOOKING_HOLD_TTL_MINUTES = config('BOOKING_HOLD_TTL_MINUTES', default=15, cast=int)

# Paso de la rejilla de candidatos del cálculo de disponibilidad (ADR-05).
BOOKING_SLOT_STEP_MINUTES = config('BOOKING_SLOT_STEP_MINUTES', default=30, cast=int)

# Comisión de la vertical. Si es None se usa PLATFORM_FEE_PERCENT de arriba.
_cleaning_fee_percent = config('CLEANING_PLATFORM_FEE_PERCENT', default='')
CLEANING_PLATFORM_FEE_PERCENT = (
    Decimal(_cleaning_fee_percent) if _cleaning_fee_percent else None
)

# CIEM-owned catalog deployment. Other installations retain multi-seller mode.
CIEM_CATALOG_ONLY = config("CIEM_CATALOG_ONLY", default=False, cast=bool)
CIEM_CATALOG_OWNER = config("CIEM_CATALOG_OWNER", default="ciem-admin")
