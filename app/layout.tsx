import type { Metadata } from "next";
import "../src/styles.css";
export const metadata: Metadata = {
  title: "Kremen Learn",
  description: "Your offline programming studio",
  icons: { icon: "/icon.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
