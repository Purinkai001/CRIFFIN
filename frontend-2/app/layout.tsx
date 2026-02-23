import type { Metadata } from "next";
import "./globals.css";




export const metadata: Metadata = {
  title: "Pathology Visualizer",
  description: "Visualize svs slides with AI",
};

import { SlideViewerProvider } from "@/contexts/SlideViewerContext";
import { ThemeProvider } from "@/contexts/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <SlideViewerProvider>
            {children}
          </SlideViewerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
