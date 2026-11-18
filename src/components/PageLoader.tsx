'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/** Úvodná obrazovka „Nahrávam…“: pri každom otvorení stránky sa zobrazí na náhodných 5 až 7 sekúnd. */
const MIN_MS = 5000
const MAX_MS = 7000

export function PageLoader() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(true) // true už na serveri, aby obsah nebliknul pred zobrazením

  useEffect(() => {
    setVisible(true)
    const ms = MIN_MS + Math.random() * (MAX_MS - MIN_MS)
    const t = setTimeout(() => setVisible(false), ms)
    return () => clearTimeout(t)
  }, [pathname])

  if (!visible) return null
  return (
    <div id="sdz-loader" role="status" aria-live="polite"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      <div className="h-14 w-14 animate-spin rounded-full border-4 border-gray-300 border-t-green-600 motion-reduce:animate-none" aria-hidden />
      <p className="mt-5 text-lg text-navy-900">Nahrávam...</p>
      <noscript><style>{'#sdz-loader{display:none!important}'}</style></noscript>
    </div>
  )
}
