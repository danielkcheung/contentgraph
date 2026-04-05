import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ContentGraph',
  description: 'Map the concept structure your content is missing with a schema.org-style knowledge graph.',
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('site_theme');if(t==='light')document.documentElement.classList.add('light')}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
