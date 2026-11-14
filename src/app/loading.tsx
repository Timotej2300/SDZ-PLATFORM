export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-4 p-6" aria-busy="true" aria-label="Načítavam">
      <div className="h-8 w-1/3 rounded bg-gray-200" />
      <div className="h-4 w-2/3 rounded bg-gray-200" />
      <div className="h-40 rounded bg-gray-200" />
    </div>
  )
}
