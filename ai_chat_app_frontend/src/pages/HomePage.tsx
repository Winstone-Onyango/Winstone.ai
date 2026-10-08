import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Brain,
  Check,
  Code2,
  Copy,
  Lightbulb,
  PenLine,
  RefreshCcw,
  Square,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getChatMessages, streamGPT } from "@/lib/api";
import TypingLoader from "@/components/TypingLoader";
import MarkdownMessage from "@/components/MarkdownMessage";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  role: string;
  content: string;
  error?: boolean;
}

const WELCOME: Msg = { id: "welcome", role: "assistant", content: "What's on your mind today?" };
const rid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

interface Suggestion {
  icon: LucideIcon;
  title: string;
  prompt: string;
}

const SUGGESTIONS: Suggestion[] = [
  { icon: Lightbulb, title: "Explain a concept", prompt: "Explain how neural networks work, like I'm 12 years old." },
  { icon: Code2, title: "Write some code", prompt: "Write a Python script that organizes my downloads folder by file type." },
  { icon: PenLine, title: "Draft something", prompt: "Draft a polite email asking my professor for a recommendation letter." },
  { icon: Brain, title: "Brainstorm ideas", prompt: "Give me 5 creative weekend project ideas I can build in one day." },
];

const isWelcome = (msgs: Msg[]) => msgs.length === 1 && msgs[0].id === WELCOME.id;

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { chat_uid } = useParams();

  const [input, setInput] = useState("");
  const [authOpen, setAuthOpen] = useState<"signin" | "signup" | null>(null);
  const [chatID, setChatID] = useState("");
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [streaming, setStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const streamingRef = useRef(false);
  const hadErrorRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const stickRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevUidRef = useRef<string | undefined>(undefined);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Burning the midnight oil";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  /* Track the chat id from the URL (mint a fresh one for new chats) */
  useEffect(() => {
    if (chat_uid) {
      if (prevUidRef.current !== undefined && prevUidRef.current !== chat_uid) {
        setMessages([WELCOME]); // switched to a different conversation
      }
      setChatID(chat_uid);
      prevUidRef.current = chat_uid;
    } else {
      setChatID(rid());
      prevUidRef.current = undefined;
    }
  }, [chat_uid]);

  /* Load persisted messages for an existing conversation */
  const { data: chatData } = useQuery({
    queryKey: ["chatMessages", chatID],
    queryFn: () => getChatMessages(chatID),
    enabled: !!user && !!chatID && !!chat_uid,
  });

  useEffect(() => {
    if (chat_uid && chatData && !streamingRef.current && !hadErrorRef.current) {
      if (Array.isArray(chatData) && chatData.length > 0) {
        setMessages(
          chatData.map((m: { id: number | string; role: string; content: string }) => ({
            id: String(m.id),
            role: m.role,
            content: m.content,
          }))
        );
      } else {
        setMessages([WELCOME]);
      }
    }
  }, [chat_uid, chatData]);

  /* Fresh chat routes always start empty */
  useEffect(() => {
    if (location.pathname === "/" || location.pathname === "/chats/new") {
      setMessages([WELCOME]);
    }
  }, [location.pathname]);

  /* Follow-the-tail autoscroll */
  useEffect(() => {
    if (stickRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, streaming]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickRef.current = nearBottom;
    setAtBottom(nearBottom);
  };

  const scrollToBottom = () => {
    stickRef.current = true;
    setAtBottom(true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const refreshLists = () => {
    queryClient.invalidateQueries({ queryKey: ["todaysChat"] });
    queryClient.invalidateQueries({ queryKey: ["yesterdaysChat"] });
    queryClient.invalidateQueries({ queryKey: ["sevenDaysChat"] });
  };

  const runStream = async (text: string, assistantId: string, regenerate: boolean) => {
    const controller = new AbortController();
    abortRef.current = controller;
    streamingRef.current = true;
    setStreaming(true);
    let cleanFinish = false;
    try {
      const res = await streamGPT(
        { chat_id: chatID, content: text, regenerate },
        (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
          );
        },
        controller.signal
      );
      if (res.error) {
        const errText = res.error;
        hadErrorRef.current = true;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, error: true, content: m.content ? `${m.content}\n\n> ⚠️ ${errText}` : errText }
              : m
          )
        );
      } else {
        cleanFinish = true;
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        hadErrorRef.current = true;
        const msg = err instanceof Error ? err.message : "Failed to send. Is the backend running?";
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, error: true, content: m.content || msg } : m))
        );
      }
    } finally {
      streamingRef.current = false;
      setStreaming(false);
      abortRef.current = null;
      refreshLists();
      if (cleanFinish) {
        queryClient.invalidateQueries({ queryKey: ["chatMessages", chatID] });
      }
    }
  };

  const handleSend = (override?: string) => {
    if (!user) {
      setAuthOpen("signup");
      return;
    }
    const text = (override ?? input).trim();
    if (!text || streaming) return;
    hadErrorRef.current = false;
    if (location.pathname === "/" || location.pathname === "/chats/new") {
      navigate(`/chats/${chatID}`);
    }
    const userMsg: Msg = { id: rid(), role: "user", content: text };
    const aiMsg: Msg = { id: rid(), role: "assistant", content: "" };
    setMessages((prev) => [...(isWelcome(prev) ? [] : prev), userMsg, aiMsg]);
    setInput("");
    void runStream(text, aiMsg.id, false);
  };

  const handleRegenerate = () => {
    if (!user) {
      setAuthOpen("signin");
      return;
    }
    if (streaming) return;
    hadErrorRef.current = false;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    let lastUserIdx = -1;
    messages.forEach((m, i) => {
      if (m.role === "user") lastUserIdx = i;
    });
    const kept = lastUserIdx >= 0 ? messages.slice(0, lastUserIdx + 1) : [lastUser];
    const aiMsg: Msg = { id: rid(), role: "assistant", content: "" };
    setMessages([...kept, aiMsg]);
    void runStream(lastUser.content, aiMsg.id, true);
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const copyText = async (m: Msg) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const isEmpty = isWelcome(messages);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* ---------- Messages ---------- */}
      <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
          {isEmpty ? (
            /* ============ Hero / empty state ============ */
            <div className="relative flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center overflow-hidden text-center">
              {/* soft brand aurora behind the hero */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 opacity-75"
                style={{
                  background:
                    "radial-gradient(58% 44% at 50% 26%, color-mix(in oklch, var(--brand-1) 24%, transparent), transparent 72%), radial-gradient(44% 34% at 78% 66%, color-mix(in oklch, var(--brand-2) 16%, transparent), transparent 70%), radial-gradient(40% 30% at 22% 72%, color-mix(in oklch, var(--brand-1) 12%, transparent), transparent 70%)",
                }}
              />
              <div className="hero-orb brand-ring flex h-16 w-16 items-center justify-center rounded-[1.4rem] shadow-2xl md:h-20 md:w-20 md:rounded-3xl"><span className="text-3xl font-black leading-none text-white drop-shadow md:text-4xl">W</span></div>
              <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
                {greeting}
                {user ? <span className="text-brand-gradient">{`, ${user.username}`}</span> : ""}
              </h1>
              <p className="mt-3 max-w-md text-muted-foreground">
                What can I help you with today? Ask anything — ideas, code, writing, and more.
              </p>
              <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">Winstone.ai ? your everyday AI copilot</p>
              <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    disabled={streaming}
                    onClick={() => handleSend(s.prompt)}
                    style={{ animationDelay: `${i * 70}ms` }}
                    className="animate-fade-up group rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg disabled:opacity-60"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                        <s.icon className="h-4 w-4" />
                      </span>
                      <span className="font-semibold">{s.title}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.prompt}</p>
                  </button>
                ))}
              </div>
              {!user && (
                <div className="animate-fade-up mt-7 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/70 px-5 py-4 text-center backdrop-blur">
                  <p className="text-sm text-muted-foreground">
                    Sign in or create a free account to start chatting ? every conversation is saved to your account.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthOpen("signup")}
                      className="bg-brand-gradient rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
                    >
                      Create account
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthOpen("signin")}
                      className="rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
                    >
                      Sign in
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5 pb-2">
              {messages.map((m, idx) => {
                const isLast = idx === messages.length - 1;

                if (m.role === "user") {
                  return (
                    <div key={m.id} className="group flex animate-fade-up justify-end">
                      <div className="flex max-w-[85%] items-start gap-2">
                        <button
                          type="button"
                          onClick={() => copyText(m)}
                          aria-label="Copy message"
                          className="mt-1.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 md:flex"
                        >
                          {copiedId === m.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <div className="bg-brand-gradient whitespace-pre-wrap break-words rounded-3xl rounded-br-xl px-4 py-2.5 text-[15px] leading-7 text-white shadow-md">
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                }

                const showTyping = streaming && isLast && !m.content && !m.error;
                return (
                  <div key={m.id} className="group flex animate-fade-up items-start">
                    <div className="bg-brand-gradient mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow">
                      <span className="text-[13px] font-bold leading-none">W</span>
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      {showTyping ? (
                        <div className="inline-flex w-fit rounded-2xl rounded-bl-xl border border-border bg-muted/60 px-4 py-2.5">
                          <TypingLoader label="Thinking…" />
                        </div>
                      ) : (
                        m.content && (
                          <div
                            className={cn(
                              "rounded-2xl rounded-bl-xl border px-4 py-3",
                              m.error ? "border-destructive/40 bg-destructive/5" : "border-border/60 bg-card"
                            )}
                          >
                            <MarkdownMessage content={m.content} />
                            {streaming && isLast && !m.error && (
                              <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-[3px] animate-pulse rounded-sm bg-primary" />
                            )}
                          </div>
                        )
                      )}

                      {/* hover actions */}
                      {m.content && !m.error && !streaming && (
                        <div className="mt-1.5 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => copyText(m)}
                            aria-label="Copy response"
                            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            {copiedId === m.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            {copiedId === m.id ? "Copied!" : "Copy"}
                          </button>
                          {isLast && (
                            <button
                              type="button"
                              onClick={handleRegenerate}
                              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            >
                              <RefreshCcw className="h-3.5 w-3.5" />
                              Regenerate
                            </button>
                          )}
                        </div>
                      )}

                      {/* error → retry */}
                      {m.error && !streaming && (
                        <button
                          type="button"
                          onClick={handleRegenerate}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/20"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Try again
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} className="h-px" />
            </div>
          )}
        </div>

        {/* scroll-to-bottom FAB (anchored to the panel viewport) */}
        {!atBottom && !isEmpty && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            className="animate-pop-in absolute bottom-6 right-5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition hover:bg-muted md:right-8"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>
      {/* ---------- Composer ---------- */}
      <div className="border-t border-border/70 bg-background/85 px-4 pb-4 pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-[1.75rem] border border-border bg-card p-2 pl-4 shadow-lg transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
            <Textarea
              placeholder={user ? "Message Winstone.ai…" : "Sign in or sign up to send a message…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              className="max-h-[200px] min-h-[44px] flex-1 resize-none border-0 bg-transparent px-0 py-2.5 text-[15px] shadow-none focus-visible:ring-0"
            />
            {streaming ? (
              <button
                type="button"
                onClick={handleStop}
                aria-label="Stop generating"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive text-white shadow-md transition hover:bg-destructive/90"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!!user && !input.trim()}
                aria-label="Send message"
                className="bg-brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-md transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 px-1.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd>
              to send
              <span className="mx-1">·</span>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                Shift + Enter
              </kbd>
              for a new line
            </span>
            <span className="hidden sm:inline">Winstone.ai can make mistakes. Verify important information.</span>
          </div>
        </div>
      </div>

      {authOpen && (
        <AuthModal mode={authOpen} onClose={() => setAuthOpen(null)} onSwitch={setAuthOpen} />
      )}
    </div>
  );
}
