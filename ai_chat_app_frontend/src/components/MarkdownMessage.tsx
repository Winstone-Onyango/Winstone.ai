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
      className={
        dark ? "overflow-hidden rounded-md border border-border" : "overflow-hidden rounded-md border border-border"
      }
    >
      <div
        className={
          dark ? "flex items-center justify-between border-b border-border bg-muted px-3 py-1.5" : "flex items-center justify-between border-b border-border bg-muted px-3 py-1.5"
        }
      >
        <span
          className="font-mono text-xs text-muted-foreground"
        >
          {language}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={dark ? oneDark : oneLight}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "0.75rem",
          background: "transparent",
          fontSize: "13px",
          lineHeight: 1.6,
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
                <code className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                  {raw}
                </code>
              );
            }
            if (!match) {
              return (
                <pre
                  className="my-3 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-[13px]"
                >
                  <code>{raw}</code>
                </pre>
              );
            }
            return <CodeBlock language={match[1]} code={raw} dark={dark} />;
          },
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="mt-4 mb-2 text-xl font-semibold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-4 mb-2 text-lg font-semibold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold first:mt-0">{children}</h3>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-7">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-border bg-muted px-3 py-1 text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-muted px-2 py-1.5 text-left font-medium">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-border px-2 py-1.5 align-top">{children}</td>,
          hr: () => <hr className="my-4 border-border" />,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
