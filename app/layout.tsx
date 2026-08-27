import type { Metadata, Viewport } from "next";
import {
  Onest,
  Space_Grotesk,
  Fraunces,
  Bricolage_Grotesque,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppFrame } from "@/components/shell/AppFrame";

const onest = Onest({ variable: "--font-onest", subsets: ["latin"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap" });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

export function generateMetadata(): Metadata {
  return {
    title: "WASL",
    description: "A local-first personal workspace for goals, tasks, notes, habits, and AI connections.",
    applicationName: "WASL",
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/apple-icon.png",
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "WASL",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#121212",
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem("wasl-theme")||localStorage.getItem("lifeos-theme");if(t){document.documentElement.dataset.theme=t;if(!localStorage.getItem("wasl-theme")){localStorage.setItem("wasl-theme",t);}}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="graphite"
      suppressHydrationWarning
      className={`${onest.variable} ${spaceGrotesk.variable} ${fraunces.variable} ${bricolage.variable} ${jetbrains.variable} antialiased`}
    >
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
