import type { Metadata } from "next";
import { Suspense } from "react";
import "./ftm.css";
import CursorHost from "./components/global/CursorHost";
import { ThemeProvider } from "./components/providers/ThemeProvider";
import FtmSettingsProvider from "./components/providers/FtmSettingsProvider";
import FtmLoadingProvider from "./components/providers/FtmLoadingProvider";
import FtmSecurityProvider from "./components/providers/FtmSecurityProvider";
import { FtmProfileAvatarProvider } from "./components/providers/FtmProfileAvatarProvider";
import airshipLogo from "../../public/ftm/airship-logo.png";

export const metadata: Metadata = {
  title: "Airship Express - Fleet & Transport Suite",
  description: "Integrated Fleet Operations Suite — real-time fleet distribution, dispatch, fuel, cost, driver and maintenance command center.",
  icons: { icon: airshipLogo.src },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="ftm-soft-app font-sans antialiased min-h-screen flex flex-col">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        <FtmSettingsProvider>
          <FtmProfileAvatarProvider>
            <ThemeProvider>
            <Suspense fallback={null}>
              <FtmLoadingProvider>
                <FtmSecurityProvider>
                  <CursorHost />
                  {children}
                </FtmSecurityProvider>
              </FtmLoadingProvider>
            </Suspense>
            </ThemeProvider>
          </FtmProfileAvatarProvider>
        </FtmSettingsProvider>
    </div>
  );
}
