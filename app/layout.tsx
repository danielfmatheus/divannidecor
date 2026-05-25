import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DivanniDecor - Medidas",
  description: "Sistema de cadastro de medidas profissional",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}