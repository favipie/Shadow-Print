import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SHADOWPRINT — Investigation workspace",
  description:
    "An evidence-first digital safety investigation prototype. All records are synthetic.",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="darkreader-lock" content="true" />
      </head>
      <body>{children}</body>
    </html>
  );
}
