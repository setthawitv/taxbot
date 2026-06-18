import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import SessionProvider from "@/components/SessionProvider";
import ChatWidget from "@/components/ChatWidget";
import "./globals.css";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vendee Finance",
  description: "บันทึกรายรับ-รายจ่าย และสรุปภาษี",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${ibmPlexSansThai.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="min-h-full flex flex-col">
          <SessionProvider>
            {children}
            <ChatWidget />
          </SessionProvider>
        </body>
    </html>
  );
}
