import type { Metadata } from "next";
import { Poppins, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={poppins.className}>{children}</body>
    </html>
  );
}
