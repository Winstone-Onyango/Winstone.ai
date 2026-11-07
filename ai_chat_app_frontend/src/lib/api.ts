import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "https://winstone-ai.onrender.com";

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT access token automatically
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("access_token");
    if (token && config.headers) {
      (config.headers as unknown as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  } catch { /* ignore */ }
  return config;
});

// Auto-refresh once on 401
let refreshing: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const refresh = localStorage.getItem("refresh_token");
      if (!refresh) return null;
      const res = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh });
      const access = res.data?.access;
      if (access) {
        localStorage.setItem("access_token", access);
        return access as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error?.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const access = await refreshAccessToken();
      if (access) {
        (original.headers as unknown as Record<string, string>)["Authorization"] = `Bearer ${access}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

/** ── Error sanitisation ───────────────────────────────────────────────
 * Strips sensitive data out of raw errors so the UI never sees tokens,
 * API keys, connection strings, or server-internal debugging text. */
function sanitizeErrorMessage(raw: string, fallback: string): string {
  let msg = raw.trim();

  // Mask / redact bearer JWT tokens
  msg = msg.replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, "Bearer [REDACTED]");
  msg = msg.replace(/eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, "[TOKEN REDACTED]");

  // Mask / redact API keys & secrets (starts with sk-, or contains AKIA, etc.)
  msg = msg.replace(/sk-[A-Za-z0-9]{20,}/g, "sk-[REDACTED]");
  msg = msg.replace(/AIza[0-9A-Za-z\-_]{33}/g, "AIza[REDACTED]");
  msg = msg.replace(/[A-Za-z0-9\-_]{32,}\.[A-Za-z0-9\-_]{2,}\.[A-Za-z0-9\-_]{2,}/g, "[REDACTED]");

  // Redact database connection strings (postgresql://user:pass@host:port/db)
  msg = msg.replace(/postgresql:\/\/[^@\s]+:[^@\s]+@/g, "postgresql://***:***@");

  // Detect common internal / infrastructure error patterns and replace with friendly messages
  const lower = msg.toLowerCase();

  if (lower.includes("connection to server") || lower.includes("unable to connect") || lower.includes("enotfound") || lower.includes("getaddrinfo") || lower.includes("network") || lower.includes("timeout") || lower.includes("fetch failed")) {
    return "The server is unreachable or timing out. Please check that the backend is running and try again.";
  }

  if (lower.includes("database") || lower.includes("postgresql") || lower.includes("supabase")) {
    return "The server cannot reach its database. Please wait a moment and try signing in again.";
  }

  if (lower.includes("500 internal server error") || lower.includes("502 bad gateway") || lower.includes("503 service unavailable") || lower.includes("504 gateway timeout")) {
    return "The server hit an unexpected error. Please try again in a moment.";
  }

  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid credentials")) {
    return "Invalid username/email or password.";
  }

  if (lower.includes("403") || lower.includes("forbidden") || lower.includes("account is disabled")) {
    return "This account is disabled. Please contact support.";
  }

  if (lower.includes("404") || lower.includes("not found")) {
    return "The server could not be found. Please check that the backend is running.";
  }

  // Remove any leftover semi-internal stack-trace fragments
  msg = msg.replace(/at [a-zA-Z0-9_.\$<>[\]]+/g, "");
  msg = msg.replace(/\(http.*\)/g, ""); // strip URLs

  // Never show the raw message if it contains suspicious internal content
  if (msg.length > 280) {
    return fallback;
  }

  return msg || fallback;
}

/** Extract a user-friendly error message, never leaking keys, tokens, or internals. */
function errMsg(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data.error === "string") return sanitizeErrorMessage(data.error, fallback);
      if (typeof data.detail === "string") return sanitizeErrorMessage(data.detail, fallback);
      // DRF serializer errors: { field: [msgs] }
      const parts: string[] = [];
      for (const k of Object.keys(data)) {
        const v = data[k];
        if (Array.isArray(v)) parts.push(`${k}: ${v.join(", ")}`);
        else if (typeof v === "string") parts.push(`${k}: ${v}`);
      }
      if (parts.length) return sanitizeErrorMessage(parts.join(" | "), fallback);
    }
    return sanitizeErrorMessage(err.message || fallback, fallback);
  }
  if (err instanceof Error) {
    return sanitizeErrorMessage(err.message, fallback);
  }
  return fallback;
}

export interface AuthUser { id: number; username: string; email: string }
export interface AuthPayload { access: string; refresh: string; user: AuthUser }

export async function register(data: { username: string; email: string; password: string }): Promise<AuthPayload> {
  try {
    const response = await api.post("/auth/register/", data);
    return response.data;
  } catch (err: unknown) {
    throw new Error(errMsg(err, "Registration failed."));
  }
}

export async function login(data: { username: string; password: string }): Promise<AuthPayload> {
  try {
    const response = await api.post("/auth/login/", data);
    return response.data;
  } catch (err: unknown) {
    throw new Error(errMsg(err, "Login failed."));
  }
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const response = await api.get("/auth/me/");
    return response.data?.user ?? null;
  } catch {
    return null;
  }
}

export async function promptGPT(data: { chat_id: string; content: string; regenerate?: boolean }) {
  try {
    const response = await api.post("/prompt_gpt/", data);
    return response.data as { reply: string; demo: boolean; error?: boolean; title?: string; chat_id?: string };
  } catch (err: unknown) {
    throw new Error(errMsg(err, "Failed to send message. Is the backend running?"));
  }
}

export interface StreamResult {
  reply: string;
  demo: boolean;
  error?: string;
  title?: string;
  chat_id?: string;
}

/**
 * Stream a chat completion over Server-Sent Events.
 * Falls back to the non-streaming endpoint if SSE is unavailable.
 */
export async function streamGPT(
  data: { chat_id: string; content: string; regenerate?: boolean },
  onDelta: (text: string) => void,
  signal?: AbortSignal
): Promise<StreamResult> {
  const token = localStorage.getItem("access_token");
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/stream_gpt/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    const fallback = await promptGPT(data);
    return { reply: fallback.reply, demo: fallback.demo, title: fallback.title, chat_id: fallback.chat_id };
  }

  if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
    const fallback = await promptGPT(data);
    if (fallback.reply) onDelta(fallback.reply);
    return {
      reply: fallback.reply,
      demo: fallback.demo,
      error: fallback.error ? fallback.reply : undefined,
      title: fallback.title,
      chat_id: fallback.chat_id,
    };
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming is not supported by this browser.");
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let meta: StreamResult = { reply: "", demo: false };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      for (const line of evt.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          const payload = JSON.parse(line.slice(5).trim());
          if (typeof payload.delta === "string") {
            reply += payload.delta;
            onDelta(payload.delta);
          }
          if (payload.done) {
            meta = {
              reply,
              demo: !!payload.demo,
              error: typeof payload.error === "string" ? payload.error : undefined,
              title: payload.title,
              chat_id: payload.chat_id,
            };
          }
        } catch {
          /* skip malformed chunks */
        }
      }
    }
  }
  return { ...meta, reply };
}

export async function getHealth() {
  try {
    const response = await api.get("/health/");
    return response.data as { ok: boolean; ai_configured: boolean; model: string; time: string };
  } catch {
    return { ok: false, ai_configured: false, model: "", time: "" };
  }
}

export async function getChatMessages(chatId: string) {
  if (!chatId) return [];
  try {
    const response = await api.get(`/get_chat_messages/${chatId}/`);
    return response.data;
  } catch (err: unknown) {
    throw new Error(errMsg(err, "Failed to load messages."));
  }
}

export async function deleteChat(chatId: string) {
  try {
    const response = await api.delete(`/delete_chat/${chatId}/`);
    return response.data;
  } catch (err: unknown) {
    throw new Error(errMsg(err, "Failed to delete chat."));
  }
}

export async function getTodaysChats() {
  try {
    const response = await api.get("/todays_chat/");
    return response.data;
  } catch (err: unknown) {
    throw new Error(errMsg(err, "Failed to load chats."));
  }
}

export async function getYesterdaysChats() {
  try {
    const response = await api.get("/yesterdays_chat/");
    return response.data;
  } catch (err: unknown) {
    throw new Error(errMsg(err, "Failed to load chats."));
  }
}

export async function getSevenDaysChats() {
  try {
    const response = await api.get("/seven_days_chat/");
    return response.data;
  } catch (err: unknown) {
    throw new Error(errMsg(err, "Failed to load chats."));
  }
}

export default api;
