"use client";

import { createContext, useContext, useState } from "react";

type ChatCtx = { open: boolean; setOpen: (v: boolean) => void };

const Ctx = createContext<ChatCtx>({ open: false, setOpen: () => {} });

export const useChat = () => useContext(Ctx);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}
