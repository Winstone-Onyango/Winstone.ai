from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("auth/register/", views.register, name="register"),
    path("auth/login/", views.login_view, name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", views.me, name="me"),
    path("prompt_gpt/", views.prompt_gpt, name="prompt_gpt"),
    path("stream_gpt/", views.stream_gpt, name="stream_gpt"),
    path("get_chat_messages/<str:pk>/", views.get_chat_messages, name="get_chat_messages"),
    path("delete_chat/<str:pk>/", views.delete_chat, name="delete_chat"),
    path("todays_chat/", views.todays_chat, name="todays_chat"),
    path("yesterdays_chat/", views.yesterdays_chat, name="yesterdays_chat"),
    path("seven_days_chat/", views.seven_days_chat, name="seven_days_chat"),
]
