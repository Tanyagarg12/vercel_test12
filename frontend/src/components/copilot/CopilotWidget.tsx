"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, History, Send, Sparkles, SquarePen, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { SUGGESTED_QUESTIONS, type ChatMessage, type CopilotAnswer } from "@/lib/copilot/types";
import { AnswerCard } from "./AnswerCard";

/** One saved copilot conversation. Kept in localStorage so history survives
 * reloads; the answers are plain JSON so they round-trip untouched. */
interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

const STORAGE_KEY = "copilot-conversations";
const MAX_CONVERSATIONS = 30;

function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Conversation[]) : [];
  } catch {
    return [];
  }
}

const EMPTY_MESSAGES: ChatMessage[] = [];

function historyDateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CopilotWidget() {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Lazy-initialised from localStorage; nothing conversation-dependent renders
  // before the widget is opened, so server and client first paints still match.
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  const messages = active?.messages ?? EMPTY_MESSAGES;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)));
    } catch {
      // Storage full or blocked — history simply stops persisting.
    }
  }, [conversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (open && !showHistory) inputRef.current?.focus();
  }, [open, showHistory, activeId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function appendMessage(conversationId: string, message: ChatMessage) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, updatedAt: Date.now(), messages: [...c.messages, message] }
          : c,
      ),
    );
  }

  function startNewChat() {
    setActiveId(null);
    setShowHistory(false);
    setInput("");
    inputRef.current?.focus();
  }

  function openConversation(id: string) {
    setActiveId(id);
    setShowHistory(false);
  }

  function deleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function ask(question: string) {
    const text = question.trim();
    if (!text || thinking) return;

    // First question of a fresh chat names the conversation.
    let conversationId = activeId;
    const userMessage: ChatMessage = { id: uid(), role: "user", text };
    if (!conversationId || !conversations.some((c) => c.id === conversationId)) {
      conversationId = uid();
      const title = text.length > 60 ? `${text.slice(0, 57)}…` : text;
      setConversations((prev) => [
        { id: conversationId!, title, updatedAt: Date.now(), messages: [userMessage] },
        ...prev.slice(0, MAX_CONVERSATIONS - 1),
      ]);
      setActiveId(conversationId);
    } else {
      appendMessage(conversationId, userMessage);
    }

    setInput("");
    setThinking(true);

    try {
      // The server route runs the tool layer against the platform — the
      // browser never sees the service address.
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const payload = await response.json();

      if (!response.ok || payload.error) {
        appendMessage(conversationId, {
          id: uid(),
          role: "assistant",
          text: payload.error ?? "The copilot could not answer that.",
        });
        return;
      }

      const answer = payload as CopilotAnswer;
      appendMessage(conversationId, { id: uid(), role: "assistant", text: answer.headline, answer });
    } catch {
      appendMessage(conversationId, {
        id: uid(),
        role: "assistant",
        text: "I could not reach the copilot service.",
      });
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
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--series-1)] text-white">
                <Bot size={17} />
              </span>
              <span className="block truncate text-[13.5px] font-semibold text-text-primary">
                AI Operations Copilot
              </span>
            </div>
            <div className="flex flex-none items-center gap-1">
              <button
                onClick={startNewChat}
                aria-label="Start a new chat"
                title="New chat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-[var(--surface-2)] hover:text-text-primary"
              >
                <SquarePen size={16} />
              </button>
              <button
                onClick={() => setShowHistory((v) => !v)}
                aria-label="Chat history"
                title="Chat history"
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--surface-2)] hover:text-text-primary",
                  showHistory ? "bg-[var(--surface-2)] text-text-primary" : "text-text-muted",
                )}
              >
                <History size={16} />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close copilot"
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-[var(--surface-2)] hover:text-text-primary"
              >
                <X size={17} />
              </button>
            </div>
          </header>

          {showHistory ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Chat history
              </div>
              {conversations.length === 0 ? (
                <p className="px-1 py-4 text-[12.5px] text-text-muted">
                  No conversations yet — ask a question to start one.
                </p>
              ) : (
                <ul className="space-y-1">
                  {conversations.map((conversation) => (
                    <li key={conversation.id} className="group flex items-center gap-1">
                      <button
                        onClick={() => openConversation(conversation.id)}
                        className={clsx(
                          "min-w-0 flex-1 rounded-lg border px-3 py-2 text-left transition-colors",
                          conversation.id === activeId
                            ? "border-[var(--series-1)] bg-[var(--surface-2)]"
                            : "border-[var(--border-hairline)] hover:border-[var(--series-1)] hover:bg-[var(--surface-2)]",
                        )}
                      >
                        <span className="block truncate text-[12.5px] font-medium text-text-primary">
                          {conversation.title}
                        </span>
                        <span className="block text-[11px] text-text-muted">
                          {historyDateLabel(conversation.updatedAt)} · {conversation.messages.length} messages
                        </span>
                      </button>
                      <button
                        onClick={() => deleteConversation(conversation.id)}
                        aria-label={`Delete conversation "${conversation.title}"`}
                        title="Delete"
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-text-muted opacity-0 transition-opacity hover:bg-[var(--status-critical-bg)] hover:text-[var(--status-critical)] focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
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
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              setShowHistory(false);
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
