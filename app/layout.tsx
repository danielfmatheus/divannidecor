import "./globals.css"; // Verifique se esta é a primeira linha
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DivanniDecor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className="antialiased">{children}</body>
    </html>
  );
}