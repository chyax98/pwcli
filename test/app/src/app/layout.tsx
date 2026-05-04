import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pwcli Test App",
  description: "Browser automation test target for pwcli",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">{children}</body>
    </html>
  );
}
