import { useState } from 'react'
import { ArrowRight, Play, Plus, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHealthData } from '../../context/HealthDataContext.jsx'
import { Button } from '../common/Button.jsx'
import { SafeImage } from '../common/SafeImage.jsx'
import { HowItWorksDialog } from './HowItWorksDialog.jsx'

function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

export function WelcomeHero() {
  const { t } = useTranslation()
  const { user } = useHealthData()
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false)

  return (
    <section
      aria-labelledby="welcome-title"
      className="relative overflow-hidden rounded-[28px] border border-white bg-[linear-gradient(115deg,#ffffff_0%,#f3f9ff_42%,#d9ecfb_100%)] shadow-card"
    >
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <div className="relative z-10 px-6 pt-8 pb-6 sm:px-10 sm:pt-10 md:pb-10">
          <p className="text-[15px] font-medium text-muted">{getGreeting()},</p>
          <h1
            id="welcome-title"
            className="mt-2 text-[2.5rem] leading-[1.02] font-extrabold tracking-tight text-navy-900 sm:text-5xl xl:text-[3.6rem]"
          >
            {t('dashboard.welcome', 'Welcome Back')},
            <br />
            <span className="bg-linear-to-r from-navy-900 via-brand-600 to-brand-500 bg-clip-text text-transparent">
              {user.firstName}!
            </span>
          </h1>
          <p className="mt-5 max-w-md text-pretty text-[15px] leading-relaxed text-muted">
            {t('dashboard.health_summary', 'Your AI-powered health companion to organize your medical records, understand your reports and take control of your well-being.')}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button to="/upload" size="lg">
              {t('dashboard.upload_records', 'Upload New Document')}
              <ArrowRight aria-hidden="true" />
            </Button>
            <button
              type="button"
              onClick={() => setIsHowItWorksOpen(true)}
              className="group inline-flex items-center gap-3 rounded-full text-[15px] font-semibold text-navy-900 cursor-pointer"
            >
              <span className="grid size-11 place-items-center rounded-full bg-white shadow-card transition-transform group-hover:scale-105">
                <Play className="size-4 fill-navy-900 text-navy-900" aria-hidden="true" />
              </span>
              Watch How It Works
            </button>
          </div>
        </div>

        <HeroVisual />
      </div>

      <HowItWorksDialog open={isHowItWorksOpen} onClose={() => setIsHowItWorksOpen(false)} />
    </section>
  )
}

function HeroVisual() {
  return (
    <div className="relative h-64 sm:h-80 md:h-auto md:min-h-[360px]">
      <div aria-hidden="true" className="absolute top-8 right-1/3 size-40 rounded-full bg-brand-200/40 blur-3xl" />
      <Plus aria-hidden="true" className="absolute top-6 left-[42%] size-8 text-white/80" strokeWidth={3} />
      <Plus aria-hidden="true" className="absolute right-6 bottom-8 size-10 text-white/70" strokeWidth={3} />

      <SafeImage
        src="/images/lungs.png"
        className="absolute inset-y-0 right-0 w-[72%] xl:right-[16%] xl:w-[60%]"
        imgClassName="size-full object-cover object-center [mask-image:radial-gradient(ellipse_at_center,#000_48%,transparent_74%)]"
      />

      <SafeImage
        src="/images/doctor.png"
        className="absolute bottom-0 left-0 h-full w-[52%] md:w-[46%] xl:left-[2%] xl:w-[34%]"
        imgClassName="size-full object-cover object-[50%_18%] [mask-image:linear-gradient(90deg,transparent_0%,#000_22%,#000_78%,transparent_100%)]"
      />

      <div className="glass absolute bottom-5 left-[30%] flex items-center gap-2.5 rounded-full py-2 pr-4 pl-2 md:left-[26%] xl:left-[24%]">
        <span className="grid size-8 place-items-center rounded-full bg-accent-400 text-navy-950">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </span>
        <span className="text-xs leading-tight font-semibold text-navy-900">
          Records stay
          <br />
          on this device
        </span>
      </div>

      <p className="absolute top-10 right-8 hidden w-40 text-[1.6rem] leading-[1.1] font-extrabold tracking-tight text-navy-900 xl:block">
        Better Health for a Brighter Tomorrow
        <span aria-hidden="true" className="mt-4 block h-1 w-14 rounded-full bg-accent-400" />
      </p>
    </div>
  )
}
