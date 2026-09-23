import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Finpill",
  description: "BIST şirketleri için finansal araştırma.",
};

// Expose native safe-area insets to the shared shell's existing CSS padding.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
