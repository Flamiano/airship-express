import type { Metadata } from "next";
import { Bricolage_Grotesque, Rethink_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { Toaster } from "sonner";
import { ConfirmProvider } from "./(supplyChain)/components/ui/ConfirmModal";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const rethink = Rethink_Sans({
  variable: "--font-rethink",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Airship Express Courier Services",
  description: "Fast, reliable courier and delivery services you can trust.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${rethink.variable} h-full antialiased bg-paper dark:bg-ink`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var theme = localStorage.getItem('airship-theme');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            })();
          `}
        </Script>
      </head>
      <body className="min-h-screen font-rethink bg-paper dark:bg-ink">
        <ThemeProvider>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
        </ThemeProvider>

        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={3000}
        />
      </body>
    </html>
  );
}