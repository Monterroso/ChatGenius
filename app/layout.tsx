import type { Metadata } from 'next'
import './globals.css'
import {Providers} from './providers'

export const metadata: Metadata = {
  title: 'The Tavern',
  description: 'Take a long rest here, and enjoy the company of your friends.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/beer.webp" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
