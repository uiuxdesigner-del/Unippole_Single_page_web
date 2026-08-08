import type { Metadata } from "next";
import { Geist, Poppins } from "next/font/google";

import FloatingSocialBubble from "@/components/ui/FloatingSocialBubble";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "ADINN UNIPOLE — Premium Outdoor Advertising",
  description:
    "Explore premium UNIPOLE outdoor advertising locations, plan campaigns and request proposals from ADINN Advertising Services.",
  openGraph: {
    title: "ADINN UNIPOLE — Visibility Built Above the Ordinary",
    description:
      "Premium large-format UNIPOLE outdoor advertising across major Indian cities.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("font-sans", geist.variable)}
    >
      <body
        className={cn(
          poppins.className,
          poppins.variable,
        )}
      >
        {children}

        {/* <FloatingSocialBubble /> */}
      </body>
    </html>
  );
}