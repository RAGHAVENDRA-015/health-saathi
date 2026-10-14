import { Link } from 'react-router-dom'
import { ArrowUpRight, HeartPulse } from 'lucide-react'
import { organFocusAreas } from '../../data/mockReports.js'
import { SafeImage } from '../common/SafeImage.jsx'

export function OrganFeatureCards() {
  return (
    <section aria-labelledby="organ-insights-title">
      <h2 id="organ-insights-title" className="sr-only">
        Health focus areas
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {organFocusAreas.map((area) => (
          <li key={area.id}>
            <Link
              to={`/reports?focus=${area.id}`}
              className="panel group relative flex h-full items-center gap-2 overflow-hidden bg-linear-to-br from-white/90 to-brand-50/80 p-3 pr-5 transition-shadow hover:shadow-pop"
            >
              <SafeImage
                src={area.image}
                fallbackIcon={HeartPulse}
                className="aspect-square w-[42%] max-w-40 shrink-0 overflow-hidden rounded-2xl"
                imgClassName="size-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <span className="min-w-0 flex-1 py-3">
                <span className="block text-[17px] leading-snug font-bold text-navy-900 text-balance">{area.title}</span>
                <span className="mt-1.5 block text-pretty text-xs leading-relaxed text-muted">{area.description}</span>
              </span>
              <span
                aria-hidden="true"
                className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-accent-400 text-navy-950 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              >
                <ArrowUpRight className="size-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
