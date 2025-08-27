import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pasapalabra — Rosco (Host-only)', description: 'Local room, two players, per-letter constraints' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}