import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cordon — Security replay for AI agents",
  description:
    "Cordon is a security trace layer and visual replay studio for tool-using AI agents. See how an agent crossed a boundary — and block it before it happens.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
