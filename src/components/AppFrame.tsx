"use client";

import { ChatProvider, useChat } from "@/components/ChatContext";
import ChatWidget from "@/components/ChatWidget";

// Shifts the whole page left (desktop) when the assistant panel is open, so the
// existing UI stays fully usable beside the chat instead of being covered.
function Shift({ children }: { children: React.ReactNode }) {
  const { open } = useChat();
  return (
    <div className={`transition-[padding] duration-300 ease-out ${open ? "lg:pr-[440px]" : ""}`}>
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
