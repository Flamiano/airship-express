import type { Metadata } from "next";
import { Bricolage_Grotesque, Rethink_Sans } from "next/font/google";
import "./globals.css";

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
      className={`${bricolage.variable} ${rethink.variable} h-full antialiased bg-[#FEFEFE]`}
    >
      <body className="h-[100dvh] overflow-hidden font-rethink bg-[#FEFEFE]">
        {children}
      </body>
    </html>
  );
}