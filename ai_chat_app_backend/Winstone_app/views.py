import json
import time
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
try:
    import google.generativeai as genai
except ImportError:  # pragma: no cover - fallback if gemini sdk not installed
    genai = None

from django.http import StreamingHttpResponse
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


def _ai_model() -> str:
    return getattr(settings, "AI_MODEL", None) or "default"


def _get_gemini_client():
    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        genai.configure(api_key=api_key)
        model_name = getattr(settings, "GEMINI_MODEL", "gemini-1.5-flash")
        system_instruction = "You are Winstone.ai, a friendly and helpful assistant."
        return genai.GenerativeModel(
            model_name=model_name, system_instruction=system_instruction
        )
    except Exception:
        return None


def _demo_reply(user_message: str) -> str:
    text = (user_message or "").strip()
    if not text:
        return "I did not catch that — could you say it again?"
    preview = text if len(text) <= 400 else text[:400] + "..."
    return (
        f"Thanks for sharing that! You said:\n\n> {preview}\n\n"
        "I am running in **demo mode** right now (no `VENICE_API_KEY` was found on the server), "
        "so I cannot reach Venice.ai yet. Add your Venice API key to the backend `.env` file to get full AI answers. "
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
    if genai is None:
        return _demo_title(user_message)
    try:
        title_model = genai.GenerativeModel(
            model_name=getattr(settings, "GEMINI_MODEL", "gemini-1.5-flash"),
            system_instruction=(
                "Give a short, descriptive title for this conversation "
                "in not more than 5 words. Return ONLY the title."
            ),
        )
        response = title_model.generate_content(user_message)
        title = (response.text or "").strip()
        return title or _demo_title(user_message)
    except Exception:
        return _demo_title(user_message)


def _friendly_ai_error(exc) -> str:
    """Turn a raw Gemini/OpenAI exception into a message that is safe to show."""
    text = str(exc or "").lower()
    # Gemini is the current provider. The classic OpenAI error checks are kept
    # as a fallback for any mixed or legacy deployment patterns.
    if (
        "unauthenticated" in text
        or "invalid api key" in text
        or "invalid key" in text
        or "401" in text
        or "permission" in text
        or "incorrect" in text
    ):
        return (
            "The server's Gemini API key looks invalid or revoked. "
            "Update GEMINI_API_KEY in the backend .env file."
        )
    if (
        "insufficient_quota" in text
        or "credit_balance_exhausted" in text
        or "no credits" in text
        or "out of credits" in text
    ):
        return (
            "My AI provider account is currently **out of credits**, so I can't generate a real reply yet. "
            "Add credits at [Google AI Studio](https://aistudio.google.com/apikey) "
            "and your next message will be answered normally.\n\n"
            "Your message above has been saved, so nothing is lost."
        )
    if (
        "429" in text
        or "rate" in text
        or "quota" in text
        or "billing" in text
        or "resource has been exceeded" in text
    ):
        return (
            "I'm hitting my rate limit right now — the AI quota looks exhausted. "
            "Please wait a moment and try again. Your message has been saved."
        )
    if "timeout" in text or "timed out" in text or "connection" in text:
        return "The AI service timed out reaching the AI provider. Check the server connection and try again."
    return "Something went wrong while contacting the AI provider. Please try again."


def _ask_gpt(openai_messages):
    """Return (text, state) where state is 'ok' | 'demo' | 'error'."""
    model = _get_gemini_client()
    if model is None:
        last_user = ""
        for m in reversed(openai_messages):
            if m.get("role") == "user":
                last_user = m.get("content", "")
                break
        return _demo_reply(last_user), "demo"
    try:
        # Gemini conversation history format: list of {role, parts} dicts.
        # The system message is handled by the model's system_instruction.
        contents = [
            {"role": m["role"], "parts": [m["content"]]}
            for m in openai_messages
            if m.get("role") != "system"
        ]
        response = model.generate_content(contents)
        text = (response.text or "").strip()
        if not text:
            return _friendly_ai_error(None), "error"
        return text, "ok"
    except Exception as e:
        return _friendly_ai_error(e), "error"


def _scope_chats(request):
    # Signed-out users must never see any conversation history.
    user = getattr(request, "user", None)
    if not (user and getattr(user, "is_authenticated", False)):
        return Chat.objects.none()
    # Signed-in users see ONLY chats owned by this account.
    return Chat.objects.filter(user=user)


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
    model = _get_gemini_client()
    return Response({
        "ok": True,
        "ai_configured": model is not None,

        "provider": getattr(settings, "AI_PROVIDER", "gemini"),
        "model": _ai_model(),
        "time": timezone.now().isoformat(),
    })


# ---------------- Chat ----------------

def _begin_chat(request, chat_id, content, regenerate=False):
    """Validate the request, get-or-create the chat, and persist the user turn.

    Returns (chat, error_response); error_response is None on success.
    """
    try:
        chat_uuid = uuid.UUID(str(chat_id))
    except (ValueError, AttributeError, TypeError):
        return None, Response({"error": "Invalid chat ID format."}, status=400)

    user = request.user if getattr(request.user, "is_authenticated", False) else None
    chat, _created = Chat.objects.get_or_create(id=chat_uuid, defaults={"user": user})
    if user is not None and chat.user is None:
        chat.user = user

    # Only generate the title for the very first turn (keep history stable)
    if chat.messages.count() == 0:
        chat.title = createChatTitle(content)
        chat.save()

    if regenerate:
        # Remove the previous assistant reply (if any) and reuse the stored user
        # turn when it matches, so retries never duplicate messages.
        last_msg = chat.messages.order_by("-created_at").first()
        if last_msg is not None and last_msg.role == "assistant":
            last_msg.delete()
        last_user = chat.messages.filter(role="user").order_by("-created_at").first()
        if last_user is None or last_user.content != content:
            ChatMessage.objects.create(role="user", chat=chat, content=content)
    else:
        ChatMessage.objects.create(role="user", chat=chat, content=content)
    return chat, None


def _build_openai_messages(chat):
    chat_messages = chat.messages.order_by("created_at")[:20]
    openai_messages = [
        {"role": m.role if m.role in ("user", "assistant", "system") else "user", "content": m.content}
        for m in chat_messages
    ]
    if not any(m["role"] in ("assistant", "system") for m in openai_messages):
        openai_messages.insert(0, {"role": "system", "content": "You are Winstone.ai, a friendly and helpful assistant."})
    return openai_messages


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def prompt_gpt(request):
    chat_id = request.data.get("chat_id")
    content = (request.data.get("content") or "").strip()
    regenerate = bool(request.data.get("regenerate"))

    if not chat_id:
        return Response({"error": "Chat ID was not provided."}, status=400)
    if not content:
        return Response({"error": "There was no prompt passed."}, status=400)

    chat, err = _begin_chat(request, chat_id, content, regenerate)
    if err is not None:
        return err

    openai_messages = _build_openai_messages(chat)
    openai_reply, state = _ask_gpt(openai_messages)

    if state == "error":
        # Persist the graceful note so the assistant turn survives reloads.
        ChatMessage.objects.create(role="assistant", content=openai_reply, chat=chat)
        chat.save(update_fields=["updated_at"])
        return Response({
            "reply": openai_reply,
            "error": True,
            "demo": False,
            "title": chat.title,
            "chat_id": str(chat.id),
        }, status=status.HTTP_200_OK)

    ChatMessage.objects.create(role="assistant", content=openai_reply, chat=chat)
    chat.save(update_fields=["updated_at"])
    return Response({
        "reply": openai_reply,
        "error": False,
        "demo": state == "demo",
        "title": chat.title,
        "chat_id": str(chat.id),
    }, status=status.HTTP_201_CREATED)


def _sse(payload: dict) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stream_gpt(request):
    """Server-sent-events variant of prompt_gpt: yields `data: {...}` chunks.

    Events: {"delta": "..."}* followed by one of:
      {"done": true, "title": ..., "chat_id": ..., "demo": bool}
      {"error": "friendly message", "done": true, ...}
    """
    chat_id = request.data.get("chat_id")
    content = (request.data.get("content") or "").strip()
    regenerate = bool(request.data.get("regenerate"))

    if not chat_id:
        return Response({"error": "Chat ID was not provided."}, status=400)
    if not content:
        return Response({"error": "There was no prompt passed."}, status=400)

    chat, err = _begin_chat(request, chat_id, content, regenerate)
    if err is not None:
        return err

    openai_messages = _build_openai_messages(chat)
    base_meta = {"title": chat.title, "chat_id": str(chat.id)}
    # Build Gemini-compatible conversation history (system message is handled
    # by the model's system_instruction and is excluded here).
    contents = [
        {"role": m["role"], "parts": [m["content"]]}
        for m in openai_messages
        if m.get("role") != "system"
    ]

    # ---- Demo mode: simulate a token stream so the UX stays identical ----
    if genai is None:
        demo_reply = _demo_reply(content)

        def demo_stream():
            ChatMessage.objects.create(role="assistant", content=demo_reply, chat=chat)
            chat.save(update_fields=["updated_at"])
            step = 8
            for i in range(0, len(demo_reply), step):
                yield _sse({"delta": demo_reply[i:i + step]})
                time.sleep(0.012)
            yield _sse({"done": True, "demo": True, **base_meta})

        return StreamingHttpResponse(demo_stream(), content_type="text/event-stream")

    # ---- Live OpenAI stream ----
    def ai_stream():
        accumulated = []
        try:
            model = genai.GenerativeModel(
                model_name=getattr(settings, "GEMINI_MODEL", "gemini-1.5-flash"),
                system_instruction="You are Winstone.ai, a friendly and helpful assistant.",
            )
            response = model.generate_content(contents, stream=True)
            for chunk in response:
                if chunk.text:
                    accumulated.append(chunk.text)
                    yield _sse({"delta": chunk.text})
            full_reply = "".join(accumulated).strip()
            if not full_reply:
                note = _friendly_ai_error(None)
                try:
                    ChatMessage.objects.create(role="assistant", content=note, chat=chat)
                    chat.save(update_fields=["updated_at"])
                except Exception:
                    pass
                yield _sse({"delta": note})
                yield _sse({"done": True, "demo": False, **base_meta})
                return
            ChatMessage.objects.create(role="assistant", content=full_reply, chat=chat)
            chat.save(update_fields=["updated_at"])
            yield _sse({"done": True, "demo": False, **base_meta})
        except GeneratorExit:
            # Client went away (e.g. pressed Stop) — keep the partial text.
            if accumulated:
                try:
                    ChatMessage.objects.create(role="assistant", content="".join(accumulated), chat=chat)
                    chat.save(update_fields=["updated_at"])
                except Exception:
                    pass
            raise
        except Exception as e:
            # Persist a graceful note so the assistant turn survives reloads
            # instead of silently vanishing from the history.
            note = _friendly_ai_error(e)
            try:
                ChatMessage.objects.create(role="assistant", content=note, chat=chat)
                chat.save(update_fields=["updated_at"])
            except Exception:
                pass
            yield _sse({"delta": note})
            yield _sse({"done": True, "demo": False, **base_meta})

    return StreamingHttpResponse(ai_stream(), content_type="text/event-stream")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
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
@permission_classes([IsAuthenticated])
def delete_chat(request, pk):
    try:
        chat_uuid = uuid.UUID(str(pk))
    except (ValueError, AttributeError, TypeError):
        return Response({"error": "Invalid chat ID."}, status=400)
    chat = get_object_or_404(_scope_chats(request), id=chat_uuid)
    chat.delete()
    return Response({"deleted": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def todays_chat(request):
    today = timezone.localdate()
    chats = _scope_chats(request).filter(created_at__date=today).order_by("-created_at")[:20]
    serializer = ChatSerializer(chats, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def yesterdays_chat(request):
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    chats = _scope_chats(request).filter(created_at__date=yesterday).order_by("-created_at")[:20]
    serializer = ChatSerializer(chats, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def seven_days_chat(request):
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    seven_days_ago = today - timedelta(days=7)
    chats = _scope_chats(request).filter(created_at__date__lt=yesterday, created_at__date__gte=seven_days_ago).order_by("-created_at")[:20]
    serializer = ChatSerializer(chats, many=True)
    return Response(serializer.data)

