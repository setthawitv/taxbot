"use client";

import { ChatProvider, useChat } from "@/components/ChatContext";
import ChatWidget from "@/components/ChatWidget";

// Shifts the whole page left (desktop) when the assistant panel is open, so the
// existing UI stays fully usable beside the chat instead of being covered.
function Shift({ children }: { children: React.ReactNode }) {
  // Width comes from the CSS var (--chat-pr) which ChatContext keeps in sync with
  // the panel width and open state — so dragging the panel resizes the page too.
  const { dragging } = useChat();
  return (
    <div className={`transition-[padding] ${dragging ? "duration-0" : "duration-300"} ease-out lg:pr-[var(--chat-pr,0px)]`}>
      {children}
    </div>
  );
}

export default function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <Shift>{children}</Shift>
      <ChatWidget />
    </ChatProvider>
  );
}
