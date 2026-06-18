"use client";

import { createContext, useContext, useEffect, useState } from "react";

const MIN_W = 320;
const DEFAULT_W = 440;
const STORAGE_KEY = "vendee_chat_width";

function clampWidth(w: number): number {
  const max = typeof window !== "undefined" ? Math.min(760, Math.round(window.innerWidth * 0.6)) : 760;
  return Math.max(MIN_W, Math.min(w, max));
}

type ChatCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  width: number;
  setWidth: (w: number) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
};

const Ctx = createContext<ChatCtx>({
  open: false, setOpen: () => {}, width: DEFAULT_W, setWidth: () => {}, dragging: false, setDragging: () => {},
});

export const useChat = () => useContext(Ctx);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [width, setWidthState] = useState(DEFAULT_W);
  const [dragging, setDragging] = useState(false);

  // Restore the user's saved panel width
  useEffect(() => {
    const v = parseInt(localStorage.getItem(STORAGE_KEY) ?? "", 10);
    if (!isNaN(v)) setWidthState(clampWidth(v));
  }, []);

  function setWidth(w: number) {
    const c = clampWidth(w);
    setWidthState(c);
    try { localStorage.setItem(STORAGE_KEY, String(c)); } catch { /* ignore */ }
  }

  // Expose width + open as CSS vars so the page-shift padding and the panel
  // width stay in sync (read via lg:pr-[var(--chat-pr)] / lg:w-[var(--chat-w)]).
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--chat-w", `${width}px`);
    root.style.setProperty("--chat-pr", open ? `${width}px` : "0px");
  }, [open, width]);

  return <Ctx.Provider value={{ open, setOpen, width, setWidth, dragging, setDragging }}>{children}</Ctx.Provider>;
}
