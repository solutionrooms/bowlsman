import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env files
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file appropriate for the deployment mode
# First try .env.local if it exists (for local development)
env_local = BASE_DIR / '.env.local'
if env_local.exists():
    load_dotenv(dotenv_path=env_local)
    
# Then try the standard .env file (for docker/production configuration)
env_file = BASE_DIR / '.env'
if env_file.exists():
    load_dotenv(dotenv_path=env_file)

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-your-dev-key-here')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'

# Set deployment mode - 'local' (default) or 'docker'
DEPLOYMENT_MODE = os.environ.get('DEPLOYMENT_MODE', 'local')

ALLOWED_HOSTS = ['*', 'localhost', '0.0.0.0', 'backend']  # More explicit host list

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'drf_spectacular',
    'users',
    'messaging',
    'social',
    'leagues',
    'rest_framework.authtoken',
    'config',  # Add config app for ApiLog model
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'config.middleware.RequestLoggingMiddleware',  # Add custom middleware for request logging
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database configuration based on deployment mode
if DEPLOYMENT_MODE == 'docker':
    # Docker configuration - uses internal Docker network hostnames
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'webapp2'),
            'USER': os.environ.get('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
            'HOST': 'bowlshub-postgres',  # Docker service name
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }
else:
    # Local development configuration - connects to locally installed PostgreSQL
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'bowlsman_local'),
            'USER': os.environ.get('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
            'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Email Configuration based on deployment mode
if DEPLOYMENT_MODE == 'local' and os.environ.get('EMAIL_MODE', 'console') == 'console':
    # Use console backend for local development
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    DEFAULT_FROM_EMAIL = 'noreply@bowlsman.example.com'
else:
    # Use SMTP for testing/production
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('SMTP_HOST', 'smtp.mailersend.net')
    EMAIL_PORT = int(os.environ.get('SMTP_PORT', 587))
    EMAIL_USE_TLS = os.environ.get('SMTP_SSL', 'false').lower() != 'true'
    EMAIL_HOST_USER = os.environ.get('SMTP_USER', '')
    EMAIL_HOST_PASSWORD = os.environ.get('SMTP_PASS', '')
    EMAIL_TIMEOUT = 30  # Timeout in seconds
    DEFAULT_FROM_EMAIL = os.environ.get('SMTP_SENDER', 'noreply@bowlshub.example.com')

REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
}

# Define authentication backends
# The development backend is added first so it's checked before the default backend
AUTHENTICATION_BACKENDS = [
    'users.auth.DevelopmentAuthBackend',  # For development testing with 'pass' password
    'django.contrib.auth.backends.ModelBackend',  # Default auth backend
]

SPECTACULAR_SETTINGS = {
    'TITLE': 'User Management API',
    'DESCRIPTION': 'API for managing users',
    'VERSION': '1.0.0',
}

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3010",
    "http://localhost:8010",
    "https://bowlshub.fridaydigital.co.uk",
]

# Frontend URL for password reset links based on deployment mode
if DEPLOYMENT_MODE == 'local':
    FRONTEND_URL = "http://localhost:3000"  # Local Next.js default port
elif DEPLOYMENT_MODE == 'docker':
    FRONTEND_URL = "http://localhost:3010"  # Docker mapped port
else:
    FRONTEND_URL = os.environ.get('FRONTEND_URL', "https://bowlshub.fridaydigital.co.uk")

CORS_ALLOW_CREDENTIALS = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'users': {
            'handlers': ['console'],
            'level': 'DEBUG',  # Changed from INFO to DEBUG
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'DEBUG',  # Changed from INFO to DEBUG
        },
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',  # Added to log database queries
            'propagate': False,
        },
    },
}

# Maximum upload file size: 15MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024  # 15MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024  # 15MB