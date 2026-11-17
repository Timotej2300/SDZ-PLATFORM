import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ActionForm } from '@/components/ActionForm'
import { Empty } from '@/components/ui'
import { fmtDateTime, NOTIFICATION_GROUPS } from '@/lib/labels'
import { markRead, savePrefs } from '@/actions/notifications'

type N = { id: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null }
type Ann = { id: string; title: string; body: string; created_at: string }

export async function NotificationsView() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  const uid = user.user?.id ?? ''
  const [{ data }, { data: anns }, { data: pref }] = await Promise.all([
    supabase.from('notifications').select('id,title,body,link,created_at,read_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('announcements').select('id,title,body,created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('notification_preferences').select('email_enabled,muted_kinds').eq('user_id', uid).maybeSingle(),
  ])
  const rows = (data ?? []) as N[]
  const unread = rows.filter((r) => !r.read_at).length
  const muted = new Set<string>((pref?.muted_kinds as string[] | undefined) ?? [])
  return (
    <div className="space-y-6">
      {((anns ?? []) as Ann[]).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-navy-900">Oznamy SDZ</h2>
          {((anns ?? []) as Ann[]).map((a) => (
            <article key={a.id} className="card border-l-4 border-l-green-600">
              <p className="font-semibold">{a.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm">{a.body}</p>
              <p className="mt-1 text-xs text-ink-600">{fmtDateTime(a.created_at)}</p>
            </article>
          ))}
        </section>
      )}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-navy-900">Oznámenia {unread > 0 && `(${unread} neprečítaných)`}</h2>
          {unread > 0 && <ActionForm action={markRead} submit="Označiť všetko ako prečítané" variant="secondary"><span /></ActionForm>}
        </div>
        {rows.length === 0 ? <Empty title="Zatiaľ nemáte žiadne oznámenia" /> : (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-300 bg-white">
            {rows.map((n) => (
              <li key={n.id} className={`flex items-start justify-between gap-3 px-4 py-3 ${n.read_at ? '' : 'bg-green-50'}`}>
                <div>
                  <p className={n.read_at ? 'text-sm' : 'text-sm font-semibold'}>
                    {n.link ? <Link href={n.link} className="hover:underline">{n.title}</Link> : n.title}
                  </p>
                  {n.body && <p className="text-sm text-ink-600">{n.body}</p>}
                  <p className="text-xs text-ink-600">{fmtDateTime(n.created_at)}</p>
                </div>
                {!n.read_at && (
                  <ActionForm action={markRead} submit="Prečítané" variant="secondary"><input type="hidden" name="id" value={n.id} /></ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 className="font-semibold">Nastavenie oznámení</h2>
        <p className="mt-1 text-sm text-ink-600">Oznámenia v systéme sa zobrazujú vždy, pokiaľ nevypnete daný druh. E-maily môžete vypnúť naraz.</p>
        <ActionForm action={savePrefs} submit="Uložiť nastavenia">
          <label className="mt-3 flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="email" defaultChecked={pref ? pref.email_enabled : true} /> Posielať oznámenia aj e-mailom
          </label>
          <div className="mt-3 grid gap-1 sm:grid-cols-2">
            {NOTIFICATION_GROUPS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={`n_${k}`} defaultChecked={!muted.has(k)} /> {label}
              </label>
            ))}
          </div>
        </ActionForm>
      </section>
    </div>
  )
}
