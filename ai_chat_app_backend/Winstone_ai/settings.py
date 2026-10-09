"""
Django settings for Winstone_ai project.
"""
import os
from pathlib import Path
from datetime import timedelta

# Load .env if present (optional - app still runs without it in demo mode)
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:  # never crash on missing dotenv
    pass

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file via django-environ (optional, if installed)
try:
    import environ
    env = environ.Env(DEBUG=(bool, False))
    environ.Env.read_env(env_file=os.path.join(BASE_DIR, '.env'))
except ImportError:
    env = None
    print("Warning: django-environ not installed. Install it: pip install django-environ")


# Quick-start development settings - unsuitable for production
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-*x!c^-$aut=t4jn)j1mks6_qus5r%m&$)l@bmyaijryme_l5qk'
)

DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(',')

# AI provider settings. App runs in DEMO mode when the requested provider's
# API key is missing (graceful echo-style fallback).
AI_PROVIDER = os.environ.get('AI_PROVIDER', 'gemini').strip().lower()
AI_BASE_URL = (os.environ.get('AI_BASE_URL') or '').strip()
AI_API_KEY = (os.environ.get('VENICE_API_KEY') or '').strip()
GEMINI_API_KEY = (os.environ.get('GEMINI_API_KEY') or '').strip()
AI_MODEL = os.environ.get('AI_MODEL') or 'default'
GEMINI_MODEL = os.environ.get('GEMINI_MODEL') or 'gemini-1.5-flash'

# Back-compat aliases (legacy names still referenced elsewhere/health payload).
OPENAI_API_KEY = AI_API_KEY
OPENAI_MODEL = AI_MODEL


# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'Winstone_app',
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
]

ROOT_URLCONF = 'Winstone_ai.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'Winstone_ai.wsgi.application'


# Database
# Uses Supabase PostgreSQL connection via DATABASE_URL environment variable
# Format: postgresql://user:password@host:5432/database?sslmode=require
if 'DATABASE_URL' in os.environ:
    import dj_database_url
    DATABASES = {
        'default': dj_database_url.parse(os.environ.get('DATABASE_URL'))
    }
else:
    # Fallback to individual settings (Supabase IPv4 Connection Pooler)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_NAME', 'postgres'),
            'USER': os.environ.get('POSTGRES_USER', 'postgres.jjvzrlqdhmxohrbhoqtn'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'winstoneonyango76'),
            'HOST': os.environ.get('POSTGRES_HOST', 'aws-1-eu-west-3.pooler.supabase.com'),
            'PORT': int(os.environ.get('POSTGRES_PORT', '5432')),
        }
    }


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# Static files
STATIC_URL = 'static/'

# Email (fixed: was MAILERS, correct key is EMAIL_BACKEND)
EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend'
)

AUTH_USER_MODEL = 'Winstone_app.CustomUser'

# Django REST Framework + JWT
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS — allow Vite dev server + any localhost port
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
