import { PublicFooter, PublicHeader } from '@/components/shell'
import { getUser } from '@/lib/auth'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  return (
    <>
      <PublicHeader signedIn={!!user} />
      <main>{children}</main>
      <PublicFooter />
    </>
  )
}
