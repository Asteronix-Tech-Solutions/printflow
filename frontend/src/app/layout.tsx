import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PintFlow | Automatic Google Form Printing System',
  description: 'Super lightweight visual dashboard and automated print engine for Google Form responses',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
