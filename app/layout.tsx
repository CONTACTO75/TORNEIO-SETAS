import "./globals.css";
import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Torneios de Dardos",
  description: "Gestão de torneios de dardos: jogadores, jornadas e árvores de eliminação.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
