from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from Winstone_app.models import Chat, ChatMessage, CustomUser

# Register your models here.

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ("email", "username")



@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    model = Chat 
    list_display = ("id", "title", "created_at")


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    models = ChatMessage 
    list_display = ("id", "role", "content", "created_at")