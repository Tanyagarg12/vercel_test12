"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import { SUGGESTED_QUESTIONS, type ChatMessage, type CopilotAnswer } from "@/lib/copilot/types";
import { AnswerCard } from "./AnswerCard";

let messageSeq = 0;
function nextId(): string {
  messageSeq += 1;
  return `m${messageSeq}`;
}

export function CopilotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || thinking) return;

    setMessages((prev) => [...prev, { id: nextId(), role: "user", text }]);
    setInput("");
    setThinking(true);

    try {
      // The server route runs the tool layer against the platform API — the
      // browser never sees the API base URL.
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const payload = await response.json();

      if (!response.ok || payload.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: payload.error ?? "The copilot could not answer that.",
          },
        ]);
        return;
      }

      const answer = payload as CopilotAnswer;
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", text: answer.headline, answer },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", text: "I could not reach the copilot service." },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open AI Operations Copilot"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--series-1)] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--series-1)] focus-visible:ring-offset-2"
        >
          <Bot size={24} />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--status-good)]">
            <Sparkles size={9} className="text-white" />
          </span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="AI Operations Copilot"
          className="fixed bottom-6 right-6 z-40 flex h-[min(620px,calc(100vh-3rem))] w-[min(420px,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-1)] shadow-2xl shadow-black/25"
        >
          <header className="flex flex-none items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--series-1)] text-white">
                <Bot size={17} />
              </span>
              <span className="leading-tight">
                <span className="block text-[13.5px] font-semibold text-text-primary">
                  AI Operations Copilot
                </span>
                <span className="flex items-center gap-1 text-[11px] text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-good)]" />
                  Grounded in POC data
                </span>
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close copilot"
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-[var(--surface-2)] hover:text-text-primary"
            >
              <X size={17} />
            </button>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div>
                <p className="text-[13px] leading-relaxed text-text-secondary">
                  Ask me about the data. I read the same Health, Anomaly, Predictive Risk and
                  Recommendation engines the dashboard uses — so my answers and the screens always agree.
                </p>
                <div className="mt-3 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    Try one of these
                  </div>
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      onClick={() => ask(question)}
                      className="block w-full rounded-lg border border-[var(--border-hairline)] px-3 py-2 text-left text-[12.5px] text-text-secondary transition-colors hover:border-[var(--series-1)] hover:bg-[var(--surface-2)] hover:text-text-primary"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--series-1)] px-3.5 py-2 text-[12.5px] leading-relaxed text-white">
                    {message.text}
                  </p>
                </div>
              ) : (
                <div
                  key={message.id}
                  className="rounded-2xl rounded-bl-sm border border-[var(--border-hairline)] bg-[var(--surface-2)]/60 px-3.5 py-3"
                >
                  {message.answer ? <AnswerCard answer={message.answer} /> : message.text}
                </div>
              ),
            )}

            {thinking && (
              <div className="flex items-center gap-2 px-1 text-[12px] text-text-muted">
                <span className="flex gap-1">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)]"
                      style={{ animationDelay: `${dot * 120}ms` }}
                    />
                  ))}
                </span>
                Querying the operational data…
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(input);
            }}
            className="flex flex-none items-center gap-2 border-t border-[var(--border-hairline)] px-3 py-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about an asset, station or trend…"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] px-3 py-2 text-[12.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-[var(--series-1)]"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              aria-label="Send question"
              className={clsx(
                "flex h-9 w-9 flex-none items-center justify-center rounded-lg text-white transition-opacity",
                !input.trim() || thinking
                  ? "cursor-not-allowed bg-[var(--text-muted)] opacity-50"
                  : "bg-[var(--series-1)] hover:opacity-90",
              )}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
