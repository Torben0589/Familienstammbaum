import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Familienstammbaum",
  description: "Unser Familienstammbaum – lokal gehostet und privat."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={inter.variable + " font-sans min-h-screen"}>{children}</body>
    </html>
  );
}
