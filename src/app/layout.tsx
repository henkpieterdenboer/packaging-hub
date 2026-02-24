import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthSessionProvider from "@/components/providers/session-provider";
import { LanguageProvider } from "@/i18n/language-provider";
import { Toaster } from "@/components/ui/sonner";
import { DemoBanner } from "@/components/demo-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Packaging Materials System",
  description: "Packaging materials ordering and inventory management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthSessionProvider>
          <LanguageProvider>
            <DemoBanner />
            {children}
            <Toaster />
          </LanguageProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
