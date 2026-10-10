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
            /* Simple empty state */
            <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-foreground"><span className="text-xl font-bold leading-none text-background">W</span></div>
              <h1 className="mt-4 text-2xl font-semibold">
                {greeting}
                {user ? <span>{`, ${user.username}`}</span> : ""}
              </h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                What can I help you with today?
              </p>
              <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    disabled={streaming}
                    onClick={() => handleSend(s.prompt)}
                    className="rounded-md border border-border bg-card p-3 text-left disabled:opacity-60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border">
                        <s.icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium">{s.title}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{s.prompt}</p>
                  </button>
                ))}
              </div>
              {!user && (
                <div className="mt-6 flex flex-col items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    Sign in or create a free account to start chatting — every conversation is saved to your account.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthOpen("signup")}
                      className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background"
                    >
                      Create account
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthOpen("signin")}
                      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium"
                    >
                      Sign in
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {messages.map((m, idx) => {
                const isLast = idx === messages.length - 1;

                if (m.role === "user") {
                  return (
                    <div key={m.id} className="group flex justify-end">
                      <div className="flex max-w-[85%] items-start gap-2">
                        <button
                          type="button"
                          onClick={() => copyText(m)}
                          aria-label="Copy message"
                          className="mt-1.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 md:flex"
                        >
                          {copiedId === m.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <div className="whitespace-pre-wrap break-words rounded-md bg-foreground px-3 py-2 text-[15px] leading-7 text-background">
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                }

                const showTyping = streaming && isLast && !m.content && !m.error;
                return (
                  <div key={m.id} className="group flex items-start">
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border text-xs font-semibold">
                      <span className="leading-none">W</span>
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      {showTyping ? (
                        <div className="inline-flex w-fit rounded-md border border-border bg-muted px-3 py-2">
                          <TypingLoader label="Thinking…" />
                        </div>
                      ) : (
                        m.content && (
                          <div
                            className={cn(
                              "rounded-md border px-3 py-2",
                              m.error ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
                            )}
                          >
                            <MarkdownMessage content={m.content} />
                            {streaming && isLast && !m.error && (
                              <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-[3px] rounded-sm bg-muted-foreground" />
                            )}
                          </div>
                        )
                      )}

                      {/* hover actions */}
                      {m.content && !m.error && !streaming && (
                        <div className="mt-1 flex gap-1 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => copyText(m)}
                            aria-label="Copy response"
                            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            {copiedId === m.id ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            {copiedId === m.id ? "Copied" : "Copy"}
                          </button>
                          {isLast && (
                            <button
                              type="button"
                              onClick={handleRegenerate}
                              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
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
                          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium"
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

        {/* scroll-to-bottom button */}
        {!atBottom && !isEmpty && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background md:right-6"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>
      {/* Composer */}
      <div className="border-t border-border bg-background px-4 pb-4 pt-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-md border border-border bg-card p-2 pl-3">
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!!user && !input.trim()}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground text-background disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-2 px-1 text-xs text-muted-foreground">
            <span>Winstone.ai can make mistakes. Verify important information.</span>
          </div>
        </div>
      </div>

      {authOpen && (
        <AuthModal mode={authOpen} onClose={() => setAuthOpen(null)} onSwitch={setAuthOpen} />
      )}
    </div>
  );
}
