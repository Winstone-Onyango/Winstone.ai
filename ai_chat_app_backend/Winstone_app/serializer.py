from rest_framework import serializers

from Winstone_app.models import Chat, ChatMessage 

     

class ChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chat 
        fields = "__all__"



# class ChatMessageSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = ChatMessage 
#         fields = ["id", "role", "content", "created_at"]


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage 
        fields = ["role", "content"]