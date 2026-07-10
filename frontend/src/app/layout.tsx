import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { ThemeProvider } from '@/lib/theme';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ShopCo — Premium E-Commerce',
    template: '%s | ShopCo',
  },
  description:
    'Discover curated premium products at ShopCo — a modern, secure, and elegant shopping experience.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  keywords: ['e-commerce', 'online shop', 'premium products', 'ShopCo'],
  authors: [{ name: 'ShopCo' }],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'ShopCo',
    title: 'ShopCo — Premium E-Commerce',
    description: 'Discover curated premium products at ShopCo.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShopCo — Premium E-Commerce',
    description: 'Discover curated premium products at ShopCo.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme') || 
                              (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              })();
            `
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <CartProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
