import type { Metadata } from "next";
import { Inter, IM_Fell_English, UnifrakturMaguntia } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const historicBody = IM_Fell_English({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-historic-body",
  display: "swap",
});

const historicHeading = UnifrakturMaguntia({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-historic-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Familienstammbaum",
  description: "Unser Familienstammbaum – lokal gehostet und privat.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning
      lang="de"
      className={`${historicBody.variable} ${historicHeading.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("familienstammbaum-theme")==="historic"){document.documentElement.dataset.theme="historic"}}catch(e){}`,
          }}
        />
      </head>
      <body className={inter.variable + " font-sans min-h-screen"}>{children}</body>
    </html>
  );
}
