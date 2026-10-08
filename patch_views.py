from pathlib import Path

p = Path(r"c:\Users\Winstone\Desktop\Winstone\ChatApp\ai_chat_app_backend\Winstone_app\views.py")
t = p.read_text(encoding="utf-8-sig")

old_helper = '''def _extract_message_and_chat(data):
    """Accept both chat_id (frontend standard) and chatId (legacy)."""
    if not isinstance(data, dict):
        return '', None
    user_message = data.get('content') or data.get('message') or data.get('prompt') or ''
    if not isinstance(user_message, str):
        user_message = str(user_message)
    chat_id = data.get('chat_id') or data.get('chatId')
    if chat_id is not None and not isinstance(chat_id, str):
        chat_id = str(chat_id)
    return user_message, chat_id'''

new_helper = '''def _payload_text(data, *keys):
    """Return the first non-empty value for any of *keys* (tolerant to legacy field names)."""
    if not isinstance(data, dict):
        return ""
    for key in keys:
        value = data.get(key)
        if isinstance(value, str):
            if value.strip():
                return value
        elif value is not None:
            return str(value)
    return ""


def _payload_chat_id(data):
    """Accept both `chat_id` (current) and `chatId` (legacy)."""
    if not isinstance(data, dict):
        return None
    chat_id = data.get("chat_id") or data.get("chatId")
    if chat_id is not None and not isinstance(chat_id, str):
        chat_id = str(chat_id)
    return chat_id'''

assert old_helper in t, "helper anchor missing"
t = t.replace(old_helper, new_helper)

old_prompt = '''def prompt_gpt(request):
    chat_id = request.data.get("chat_id")
    content = (request.data.get("content") or "").strip()'''
new_prompt = '''def prompt_gpt(request):
    chat_id = _payload_chat_id(request.data)
    content = _payload_text(request.data, "content", "message", "prompt").strip()'''
assert old_prompt in t, "prompt anchor missing"
t = t.replace(old_prompt, new_prompt)

old_stream = '''    chat_id = request.data.get("chat_id")
    content = (request.data.get("content") or "").strip()
    regenerate = request.data.get("regenerate", False)'''
new_stream = '''    chat_id = _payload_chat_id(request.data)
    content = _payload_text(request.data, "content", "message", "prompt").strip()
    regenerate = request.data.get("regenerate", False)'''
assert old_stream in t, "stream anchor missing"
t = t.replace(old_stream, new_stream)

p.write_text(t, encoding="utf-8")
print("VIEWS_PATCHED_OK")
