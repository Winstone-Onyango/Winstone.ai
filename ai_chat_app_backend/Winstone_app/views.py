import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from Winstone_app.models import Chat, ChatMessage
from Winstone_app.serializer import (
    ChatMessageSerializer,
    ChatSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()


def _get_openai_client():
    api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=api_key)
    except Exception:
        return None


def _demo_reply(user_message: str) -> str:
    text = (user_message or "").strip()
    if not text:
        return "I did not catch that — could you say it again?"
    preview = text if len(text) <= 400 else text[:400] + "..."
    return (
        f"Thanks for sharing that! You said:\n\n> {preview}\n\n"
        "I am running in **demo mode** right now (no `OPENAI_API_KEY` was found on the server), "
        "so I cannot call GPT yet. Add your OpenAI key to the backend `.env` file to get full AI answers. "
        "In the meantime — what else is on your mind?"
    )


def _demo_title(user_message: str) -> str:
    text = " ".join((user_message or "").split())
    if not text:
        return "New conversation"
    words = text.split()[:6]
    title = " ".join(words)
    return title if len(title) <= 60 else title[:57] + "..."


def createChatTitle(user_message):
    client = _get_openai_client()
    if client is None:
        return _demo_title(user_message)
    try:
        response = client.chat.completions.create(
            model=getattr(settings, "OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": "Give a short, descriptive title for this conversation in not more than 5 words. Return ONLY the title."},
                {"role": "user", "content": user_message},
            ],
        )
        title = (response.choices[0].message.content or "").strip().strip(chr(34)).strip(chr(39))
        return title or _demo_title(user_message)
    except Exception:
        return _demo_title(user_message)


def _ask_gpt(openai_messages):
    client = _get_openai_client()
    if client is None:
        last_user = ""
        for m in reversed(openai_messages):
            if m.get("role") == "user":
                last_user = m.get("content", "")
                break
        return _demo_reply(last_user), True
    try:
        response = client.chat.completions.create(
            model=getattr(settings, "OPENAI_MODEL", "gpt-4o-mini"),
            messages=openai_messages,
        )
        return (response.choices[0].message.content or "").strip(), False
    except Exception as e:
        return f"An error from OpenAI: {str(e)}", False


def _scope_chats(request):
    qs = Chat.objects.all()
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        owned = qs.filter(user=user)
        # Backwards compat: include legacy chats with no user as well
        legacy = qs.filter(user__isnull=True)
        return (owned | legacy).distinct()
    return qs


def _tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
        "user": UserSerializer(user).data,
    }


# ---------------- Auth ----------------

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    user = serializer.save()
    return Response(_tokens_for_user(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    identifier = (request.data.get("username") or request.data.get("email") or "").strip()
    password = request.data.get("password") or ""
    if not identifier or not password:
        return Response({"error": "Username/email and password are required."}, status=400)
    try:
        if "@" in identifier:
            user_obj = User.objects.get(email__iexact=identifier)
        else:
            user_obj = User.objects.get(username__iexact=identifier)
    except User.DoesNotExist:
        return Response({"error": "Invalid credentials."}, status=401)
    if not user_obj.check_password(password):
        return Response({"error": "Invalid credentials."}, status=401)
    if not user_obj.is_active:
        return Response({"error": "This account is disabled."}, status=403)
    return Response(_tokens_for_user(user_obj), status=status.HTTP_200_OK)


@api_view(["GET"])
def me(request):
    if not getattr(request.user, "is_authenticated", False):
        return Response({"user": None}, status=200)
    return Response({"user": UserSerializer(request.user).data}, status=200)


@api_view(["GET"])
def health(request):
    client = _get_openai_client()
    return Response({
        "ok": True,
        "ai_configured": client is not None,
        "model": getattr(settings, "OPENAI_MODEL", "gpt-4o-mini"),
        "time": timezone.now().isoformat(),
    })


# ---------------- Chat ----------------

@api_view(["POST"])
def prompt_gpt(request):
    chat_id = request.data.get("chat_id")
    content = (request.data.get("content") or "").strip()

    if not chat_id:
        return Response({"error": "Chat ID was not provided."}, status=400)
    if not content:
        return Response({"error": "There was no prompt passed."}, status=400)

    try:
        chat_uuid = uuid.UUID(str(chat_id))
    except (ValueError, AttributeError, TypeError):
        return Response({"error": "Invalid chat ID format."}, status=400)

    user = request.user if getattr(request.user, "is_authenticated", False) else None
    chat, created = Chat.objects.get_or_create(id=chat_uuid, defaults={"user": user})
    if user is not None and chat.user is None:
        chat.user = user
    # Only generate/change title for the first user message (keep history stable)
    first_message = chat.messages.count() == 0
    if first_message:
        chat.title = createChatTitle(content)
    chat.save()

    ChatMessage.objects.create(role="user", chat=chat, content=content)

    chat_messages = chat.messages.order_by("created_at")[:20]
    openai_messages = [{"role": m.role if m.role in ("user", "assistant", "system") else "user", "content": m.content} for m in chat_messages]
    if not any(m["role"] in ("assistant", "system") for m in openai_messages):
        openai_messages.insert(0, {"role": "system", "content": "You are Winstone.ai, a friendly and helpful assistant."})

    openai_reply, is_demo = _ask_gpt(openai_messages)
    if not openai_reply:
        openai_reply = _demo_reply(content)
        is_demo = True

    ChatMessage.objects.create(role="assistant", content=openai_reply, chat=chat)
    chat.save(update_fields=["updated_at"])
    return Response({"reply": openai_reply, "demo": is_demo, "title": chat.title, "chat_id": str(chat.id)}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def get_chat_messages(request, pk):
    try:
        chat_uuid = uuid.UUID(str(pk))
    except (ValueError, AttributeError, TypeError):
        return Response({"error": "Invalid chat ID."}, status=400)
    chat = get_object_or_404(_scope_chats(request), id=chat_uuid)
    chatmessages = chat.messages.order_by("created_at").all()
    serializer = ChatMessageSerializer(chatmessages, many=True)
    return Response(serializer.data)


@api_view(["DELETE"])
def delete_chat(request, pk):
    try:
        chat_uuid = uuid.UUID(str(pk))
    except (ValueError, AttributeError, TypeError):
        return Response({"error": "Invalid chat ID."}, status=400)
    chat = get_object_or_404(_scope_chats(request), id=chat_uuid)
    chat.delete()
    return Response({"deleted": True})


@api_view(["GET"])
def todays_chat(request):
    today = timezone.localdate()
    chats = _scope_chats(request).filter(created_at__date=today).order_by("-created_at")[:20]
    serializer = ChatSerializer(chats, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def yesterdays_chat(request):
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    chats = _scope_chats(request).filter(created_at__date=yesterday).order_by("-created_at")[:20]
    serializer = ChatSerializer(chats, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def seven_days_chat(request):
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    seven_days_ago = today - timedelta(days=7)
    chats = _scope_chats(request).filter(created_at__date__lt=yesterday, created_at__date__gte=seven_days_ago).order_by("-created_at")[:20]
    serializer = ChatSerializer(chats, many=True)
    return Response(serializer.data)

