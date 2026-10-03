from django.urls import path 
from . import views 



urlpatterns = [
    path("prompt_gpt/", views.prompt_gpt, name="prompt_gpt"),
    path("get_chat_messages/<str:pk>/", views.get_chat_messages, name="get_chat_messages"),
    path("todays_chat/", views.todays_chat, name="todays_chat"),
    path("yesterdays_chat/", views.yesterdays_chat, name="yesterdays_chat"),
    path("seven_days_chat/", views.seven_days_chat, name="seven_days_chat")
]