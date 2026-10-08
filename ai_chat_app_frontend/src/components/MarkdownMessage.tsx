import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDarkMode } from "@/hooks/use-dark";

function CodeBlock({ language, code, dark }: { language: string; code: string; dark: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className={cn(
        "my-3 overflow-hidden rounded-xl border shadow-sm",
        dark ? "border-white/10 bg-[#0d1117]" : "border-border bg-slate-50"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-3 py-1.5",
          dark ? "border-b border-white/10 bg-white/5" : "border-b border-border bg-slate-100/80"
        )}
      >
        <span
          className={cn(
            "font-mono text-[11px] font-medium uppercase tracking-wider",
            dark ? "text-slate-400" : "text-slate-500"
          )}
        >
          {language}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition",
            dark
              ? "text-slate-400 hover:bg-white/10 hover:text-slate-200"
              : "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={dark ? oneDark : oneLight}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "0.9rem 1rem",
          background: "transparent",
          fontSize: "13px",
          lineHeight: 1.65,
          overflowX: "auto",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

interface Props {
  content: string;
  className?: string;
}

/**
 * Chat-bubble markdown renderer: GFM (tables, lists, task lists) plus
 * syntax-highlighted code blocks with a copy button.
 */
export default function MarkdownMessage({ content, className }: Props) {
  const dark = useDarkMode();

  return (
    <div className={cn("text-[15px] leading-7", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className: cls, children }) => {
            const match = /language-(\w+)/.exec(cls ?? "");
            const raw = String(children).replace(/\n$/, "");
            const isBlock = Boolean(match) || raw.includes("\n");
            if (!isBlock) {
              return (
                <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
                  {raw}
                </code>
              );
            }
            if (!match) {
              return (
                <pre
                  className={cn(
                    "my-3 overflow-x-auto rounded-xl border p-4 font-mono text-[13px] leading-1.65",
                    dark ? "border-white/10 bg-[#0d1117]" : "border-border bg-slate-50"
                  )}
                >
                  <code>{raw}</code>
                </pre>
              );
            }
            return <CodeBlock language={match[1]} code={raw} dark={dark} />;
          },
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="mt-6 mb-3 text-2xl font-bold tracking-tight first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-5 mb-2.5 text-xl font-bold tracking-tight first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-4 mb-2 text-lg font-semibold first:mt-0">{children}</h3>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-6">{children}</ol>,
          li: ({ children }) => <li className="leading-7 marker:text-primary">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline underline-offset-4 hover:opacity-80"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 rounded-r-xl border-l-4 border-primary/50 bg-muted px-4 py-2 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-muted px-3 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-border px-3 py-2 align-top">{children}</td>,
          hr: () => <hr className="my-5 border-border" />,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
