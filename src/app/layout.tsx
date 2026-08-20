import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Latch - your personal relay",
  description: "A quiet place to hold notes, links, and files between devices.",
  applicationName: "Latch",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Latch",
  },
};

export const viewport: Viewport = {
  themeColor: "#141512",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
