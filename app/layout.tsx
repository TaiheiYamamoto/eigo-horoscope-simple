export const metadata = {
  title: "英語で星占い",
  description: "STTで答えて、AIが英語で占い→日本語訳・TTSも出す学習ページ"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
