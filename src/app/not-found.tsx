import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-5xl font-bold text-navy-900">404</p>
      <p className="mt-3 text-ink-600">Táto stránka neexistuje alebo nie je dostupná.</p>
      <Link href="/" className="btn-primary mt-6">Na úvodnú stránku</Link>
    </main>
  )
}
