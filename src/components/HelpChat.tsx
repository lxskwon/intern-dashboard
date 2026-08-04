"use client";

import { useEffect, useRef, useState } from "react";
import { helpChatAction } from "@/lib/actions";
import { useT } from "./LangProvider";
import type { HelpMessage } from "@/lib/help";

export function HelpChat() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    const next: HelpMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await helpChatAction(next);
      const reply = "reply" in res ? res.reply : res.error;
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...next, { role: "assistant", content: t("죄송해요, 지금은 도움말을 사용할 수 없어요.") }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {open && (
        <div className="help-panel" role="dialog" aria-label={t("도움말")}>
          <div className="help-head">
            <span>💬 {t("도움말")}</span>
            <button
              type="button"
              className="help-close"
              onClick={() => setOpen(false)}
              aria-label={t("닫기")}
            >
              ×
            </button>
          </div>
          <div className="help-msgs" ref={listRef}>
            <div className="help-msg bot">{t("안녕하세요! 대시보드 사용에 대해 무엇이든 물어보세요.")}</div>
            {messages.map((m, i) => (
              <div key={i} className={`help-msg ${m.role === "user" ? "me" : "bot"}`}>
                {m.content}
              </div>
            ))}
            {pending && <div className="help-msg bot help-typing">…</div>}
          </div>
          <form
            className="help-input"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder={t("궁금한 점을 물어보세요…")}
              disabled={pending}
            />
            <button type="submit" className="btn btn-sm btn-primary" disabled={pending || !input.trim()}>
              {t("전송")}
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        className="help-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("도움말")}
        title={t("도움말")}
      >
        {open ? "×" : "?"}
      </button>
    </>
  );
}
