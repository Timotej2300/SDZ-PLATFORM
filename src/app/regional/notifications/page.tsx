import { NotificationsView } from '@/components/Notifications'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Oznámenia' }

export default async function Page() {
  return (
    <div>
      <PageHeader title="Oznámenia" intro="Správy o prihláškach, licencii, podujatiach a oznamy SDZ." />
      <NotificationsView />
    </div>
  )
}
