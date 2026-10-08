import { useEffect, useRef, useState } from "react";
import { SendHorizonalIcon, Sparkles, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getChatMessages, promptGPT } from "@/lib/api";
import TypingLoader from "@/components/TypingLoader";
import { useAuth } from "@/context/AuthContext";

interface Msg { role: string; content: string; }
const WELCOME: Msg = { role: "assistant", content: "What's on your mind today?" };

export default function Homepage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [chatID, setChatID] = useState("");
  const { chat_uid } = useParams();
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [sendError, setSendError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chat_uid) setChatID(chat_uid);
    else setChatID(crypto.randomUUID());
  }, [chat_uid]);

  const mutation = useMutation({
    mutationFn: promptGPT,
    onSuccess: (res) => {
      setSendError("");
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      queryClient.invalidateQueries({ queryKey: ["todaysChat"] });
      queryClient.invalidateQueries({ queryKey: ["sevenDaysChat"] });
    },
    onError: (e: unknown) => {
      setSendError(e instanceof Error ? e.message : "Failed to send.");
    },
  });

  const { data: chatData } = useQuery({
    queryKey: ["chatMessages", chatID],
    queryFn: () => getChatMessages(chatID),
    enabled: !!chatID && !!chat_uid,
  });

  useEffect(() => {
    if (chat_uid && chatData) {
      if (Array.isArray(chatData) && chatData.length > 0) setMessages(chatData);
      else setMessages([WELCOME]);
    }
  }, [chat_uid, chatData]);

  useEffect(() => {
    if (location.pathname === "/" || location.pathname === "/chats/new") {
      setMessages([WELCOME]);
      setSendError("");
    }
  }, [location.pathname]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mutation.isPending]);

  const handleSend = () => {
    if (!input.trim() || mutation.isPending) return;
    if (location.pathname === "/" || location.pathname === "/chats/new") {
      navigate(`/chats/${chatID}`);
    }
    const text = input.trim();
    setMessages((prev) => {
      const clean = prev.length === 1 && prev[0].content === WELCOME.content ? [] : prev;
      return [...clean, { role: "user", content: text }];
    });
    mutation.mutate({ chat_id: chatID, content: text });
    setInput("");
  };

  const isEmpty = messages.length === 1 && messages[0].content === WELCOME.content;

  return (
    <div className="flex flex-1">
      <div className="flex flex-col flex-1 bg-background text-foreground">
        <div className="flex-1 overflow-y-auto p-6">
          {isEmpty ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                <Sparkles className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">What&apos;s on your mind today?</h1>
              <p className="mt-3 max-w-md text-muted-foreground">
                {user ? `Hi ${user.username}, ask anything, brainstorm ideas, or debug code.` : "Ask anything. Sign in to save history."}
              </p>
              {sendError && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />{sendError}
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg, idx) =>
                msg.role === "user" ? (
                  <div key={idx} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground shadow">{msg.content}</div>
                ) : (
                  <div key={idx} className="prose dark:prose-invert max-w-none bg-muted p-4 rounded-2xl rounded-bl-md shadow">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )
              )}
              {mutation.isPending && <div className="bg-muted rounded-2xl p-2 w-fit shadow"><TypingLoader /></div>}
              {sendError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />{sendError}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
        <div className="border-t p-4 sticky bottom-0 z-40 bg-background">
          <div className="max-w-3xl mx-auto flex items-end gap-3">
            <Textarea
              placeholder="Message Winstone.ai..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              className="flex-1 resize-none min-h-[56px] max-h-[200px] rounded-2xl border border-input bg-muted/40 px-4 py-3 text-sm shadow-sm transition"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || mutation.isPending}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SendHorizonalIcon size={18} className="cursor-pointer" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">Winstone.ai can make mistakes. Verify important information.</p>
        </div>
      </div>
    </div>
  );
}
