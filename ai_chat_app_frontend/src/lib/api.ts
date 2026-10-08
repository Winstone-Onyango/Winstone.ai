import axios from "axios";

const BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "http://127.0.0.1:8000";

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT access token automatically
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any)["Authorization"] = `Bearer ${token}`;
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
  async (error) => {
    const original: any = error.config;
    if (error?.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const access = await refreshAccessToken();
      if (access) {
        original.headers = original.headers ?? {};
        original.headers["Authorization"] = `Bearer ${access}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

function errMsg(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const data: any = err.response?.data;
    if (data) {
      if (typeof data.error === "string") return data.error;
      if (typeof data.detail === "string") return data.detail;
      // DRF serializer errors: { field: [msgs] }
      const parts: string[] = [];
      for (const k of Object.keys(data)) {
        const v = (data as any)[k];
        if (Array.isArray(v)) parts.push(`${k}: ${v.join(", ")}`);
        else if (typeof v === "string") parts.push(`${k}: ${v}`);
      }
      if (parts.length) return parts.join(" | ");
    }
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message;
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

export async function promptGPT(data: { chat_id: string; content: string }) {
  try {
    const response = await api.post("/prompt_gpt/", data);
    return response.data;
  } catch (err: unknown) {
    throw new Error(errMsg(err, "Failed to send message. Is the backend running?"));
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
