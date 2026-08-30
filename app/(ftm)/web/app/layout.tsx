import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import CursorHost from "./components/CursorHost";
import { ThemeProvider } from "./components/ThemeProvider";
import FtmLoadingProvider from "./components/FtmLoadingProvider";

export const metadata: Metadata = {
  title: "Airship Express - Fleet & Transport Suite",
  description: "Integrated Fleet Operations Suite — real-time fleet distribution, dispatch, fuel, cost, driver and maintenance command center.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <ThemeProvider>
          <FtmLoadingProvider>
            <CursorHost />
            {children}
          </FtmLoadingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
