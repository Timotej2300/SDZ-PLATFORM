import { Logo } from '@/components/shell'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="border-b border-gray-300 bg-white px-4 py-3">
        <div className="mx-auto max-w-6xl"><Logo /></div>
      </div>
      <main className="mx-auto w-full max-w-md px-4 py-10">{children}</main>
    </div>
  )
}
