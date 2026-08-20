import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Latch - your personal relay",
  description: "A quiet place to hold notes, links, and files between devices.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
