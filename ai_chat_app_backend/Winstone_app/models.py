import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser # Making the emails unique for the user model

# Create your models here.

class CustomUser(AbstractUser): # Making the emails unique for the user model
    email = models.EmailField(unique=True)

    def __str__(self):
        return self.username



class Chat(models.Model):
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    title = models.CharField(max_length=255, blank=True, null=True)  # Optional, for UI display
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title or f"Session {self.id}"




class ChatMessage(models.Model):

    ROLES = (("assistant", "assistant"),
             ("user", "user")
             )

    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=15, choices=ROLES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"