import type { Metadata } from 'next'
import './globals.css'
import { MessagingProvider } from './messaging/context/MessagingContext'

export const metadata: Metadata = {
  title: 'BowlsHub',
  description: 'Bowling competition management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <MessagingProvider>
          {children}
        </MessagingProvider>
      </body>
    </html>
  )
}
