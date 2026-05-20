import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Han · terminal-native event layer',
  description:
    'Han is the terminal-native event layer for AI-native builders. Run hackathons and workshops where the build corpus and the builder graph stay yours.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>
        <div className="min-h-dvh bg-ink text-cream">{children}</div>
      </body>
    </html>
  );
}
