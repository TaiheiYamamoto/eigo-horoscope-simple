// app/layout.tsx
import type { ReactNode } from "react";

export const metadata = {
  title: "英語で星占い",
  description: "最小構成のテスト"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
