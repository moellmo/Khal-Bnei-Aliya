import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Khal Bnei Aliya",
    template: "%s | Khal Bnei Aliya",
  },
  description:
    "Khal Bnei Aliya member portal, davening times, donations, and community updates.",
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/icon.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    apple: [
      {
        url: "/apple-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
  openGraph: {
    title: "Khal Bnei Aliya",
    description:
      "Member portal, davening times, donations, and community updates for Khal Bnei Aliya.",
    siteName: "Khal Bnei Aliya",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
