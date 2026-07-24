import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import Providers from "../components/Providers";

export const metadata: Metadata = {
  title: "Prism - Job Application Assistant",
  description: "A premium personal assistant for tracking and applying to jobs",
  icons: {
    icon: "/prism_logo.png",
    shortcut: "/prism_logo.png",
    apple: "/prism_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute="data" defaultMode="light" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
