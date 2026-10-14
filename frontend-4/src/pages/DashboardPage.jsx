import { AiInsightsPanel } from '../components/dashboard/AiInsightsPanel.jsx'
import { OrganFeatureCards } from '../components/dashboard/OrganFeatureCards.jsx'
import { RecentDocuments } from '../components/dashboard/RecentDocuments.jsx'
import { StatCards } from '../components/dashboard/StatCards.jsx'
import { WelcomeHero } from '../components/dashboard/WelcomeHero.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

export default function DashboardPage() {
  useDocumentTitle('Dashboard')

  return (
    <div className="flex flex-col gap-5">
      <WelcomeHero />
      <StatCards />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <RecentDocuments />
        <AiInsightsPanel />
      </div>
      <OrganFeatureCards />
    </div>
  )
}
