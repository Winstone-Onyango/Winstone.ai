# Winstone.ai — Chat App

AI chat app with **Django REST backend** + **React (Vite) frontend**.

## Quick start (2 terminals)

### 1) Backend — http://127.0.0.1:8000
```powershell
cd ai_chat_app_backend
..\.venv\Scripts\Activate.ps1
pip install -r requirements.txt   # if missing: pip install django djangorestframework django-cors-headers djangorestframework-simplejwt openai python-dotenv
python manage.py migrate
python manage.py runserver
```

> The backend runs even **without** an OpenAI key — it answers in **demo mode**.
> To enable real GPT answers, put your key in `ai_chat_app_backend/.env`:
> ```
> OPENAI_API_KEY=sk-your-key-here
> OPENAI_MODEL=gpt-4o-mini
> ```

### 2) Frontend — http://localhost:5173
```powershell
cd ai_chat_app_frontend
npm install
npm run dev
```
`VITE_API_URL` (in `ai_chat_app_frontend/.env`) points at the backend.

## What was fixed
- **Backend now actually runs**: `Winstone_ai/urls.py` includes the app routes
  (before, `/prompt_gpt/`, `/todays_chat/` etc. all 404'd).
- **CORS enabled** (`django-cors-headers`) so the Vite app can call Django.
- **Auth added**: `POST /auth/register/`, `POST /auth/login/`,
  `POST /auth/refresh/`, `GET /auth/me/` (JWT). Chats are linked to the
  logged-in user; old anonymous chats still load.
- **No-crash OpenAI**: missing/invalid key no longer 500s — you get a clear
  demo reply telling you to add `OPENAI_API_KEY`. Date filters use
  `timezone.localdate()` computed per-request (old code froze `now` at import).
- **UUID validation + title stability** (title only set on first message).
- **New**: `DELETE /delete_chat/<id>/`, `GET /health/`.
- **Frontend**: proper Sign in / Sign up modal + Sign out (old navbar showed
  both dead buttons at once), auth token attach + auto-refresh, empty state
  shows **"What's on your mind today?"** after sign-in, working New Chat,
  sidebar grouped Today / Yesterday / Last 7 Days with delete, error banners,
  dark-mode toggle persisted.
