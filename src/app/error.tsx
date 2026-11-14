'use client'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-xl font-bold text-navy-900">Niečo sa pokazilo</p>
      <p className="mt-2 text-ink-600">Skúste stránku načítať znova. Ak problém pretrváva, kontaktujte nás.</p>
      <button onClick={reset} className="btn-primary mt-6">Skúsiť znova</button>
    </main>
  )
}
