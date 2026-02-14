import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FatedFortress - Build with people who actually ship',
  description: 'The resume is a lie. FatedFortress replaces LinkedIn theater with verified contributions. Earn XP through real work. Join Execution Squads. Ship with people who actually deliver.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
