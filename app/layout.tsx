/**
 * 根布局组件
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import StyledComponentsRegistry from './registry';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Green - 智能碳排放评估系统',
  description: '基于AI的个人碳足迹计算助手，帮助您理解和减少日常活动的碳排放量',
  keywords: ['碳排放', '碳足迹', 'AI', '环保', '可持续发展', 'carbon emission', 'carbon footprint'],
  authors: [{ name: 'Green Development Team' }],
  creator: 'Green Development Team',
  publisher: 'Green',
  robots: 'index, follow',
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#4CAF50',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://green-carbon-assessment.vercel.app',
    title: 'Green - 智能碳排放评估系统',
    description: '基于AI的个人碳足迹计算助手',
    siteName: 'Green',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Green - 智能碳排放评估系统',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Green - 智能碳排放评估系统',
    description: '基于AI的个人碳足迹计算助手',
    images: ['/og-image.png'],
    creator: '@green_carbon',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className}>
        <StyledComponentsRegistry>
          {children}
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}