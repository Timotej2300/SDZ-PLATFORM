import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PageLoader } from '@/components/PageLoader'

export const metadata: Metadata = {
  title: { default: 'Slovenský dobrovoľnícky zväz – SDZ', template: '%s | SDZ' },
  description: 'SDZ – Jedno miesto pre všetkých, ktorí chcú pomáhať. Platforma na správu dobrovoľníctva.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0F2A4A' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <PageLoader />
        {children}
      </body>
    </html>
  )
}
