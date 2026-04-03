import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: {
    default: '追影 | NAS网盘推送系统',
    template: '%s | 追影',
  },
  description:
    '追影是一套运行在 NAS 上的私有化多网盘独立隔离自动化推送系统。统一管理115/阿里云/夸克/天翼/百度等多网盘，实现文件监控、自动分享、智能识别、多渠道推送。',
  keywords: [
    '追影',
    'NAS',
    '网盘管理',
    '自动推送',
    '115网盘',
    '阿里云盘',
    '夸克网盘',
    '天翼网盘',
    '百度网盘',
  ],
  authors: [{ name: '追影团队' }],
  icons: {
    icon: '/logo.svg',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        <MainLayout>{children}</MainLayout>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
