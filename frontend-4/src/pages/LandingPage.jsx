import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity, ArrowRight, Check, ChevronRight,
  FileText, Menu, MessageCircleHeart, ShieldCheck,
  Sparkles, Stethoscope, UploadCloud, X,
} from 'lucide-react'
import { Logo } from '../components/layout/Logo.jsx'
import { SafeImage } from '../components/common/SafeImage.jsx'
import { Button } from '../components/common/Button.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

const features = [
  { icon: FileText, title: 'Your records, together', description: 'Bring lab reports, prescriptions and scans into one organized place.' },
  { icon: Sparkles, title: 'Clearer explanations', description: 'Explore medical terms and sample report findings in straightforward language.' },
  { icon: Activity, title: 'A connected timeline', description: 'See how your health documents fit together over time.' },
  { icon: MessageCircleHeart, title: 'Questions worth asking', description: 'Prepare focused questions for your next conversation with a clinician.' },
]

const organs = [
  { image: '/images/brain.png', title: 'Brain health', copy: 'Explore neurological report details.' },
  { image: '/images/liver.png', title: 'Liver function', copy: 'Review sample liver test results.' },
  { image: '/images/kidney.png', title: 'Kidney health', copy: 'Keep kidney-related records together.' },
  { image: '/images/heart.png', title: 'Heart health', copy: 'Browse cardiac reports and trends.' },
]

const steps = [
  { n: '01', title: 'Bring records together', text: 'Start with your lab reports, prescriptions, scans and discharge summaries.' },
  { n: '02', title: 'Explore the details', text: 'Review documents, key values and clearly labelled sample explanations.' },
  { n: '03', title: 'Prepare for care', text: 'Keep a timeline and prepare useful questions for your healthcare provider.' },
]

export default function LandingPage() {
  useDocumentTitle('Understand Your Health, Better')
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  // Seamless redirect: if user is already authenticated, take them directly to home / dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isLoading, isAuthenticated, navigate])

  const scrollTo = (id) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ice-50">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-3 border-brand-200 border-t-brand-600" />
          <p className="text-xs font-semibold text-muted">Restoring your session…</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden text-navy-900">
      <header className="relative z-20 mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12 lg:py-6">
        <Logo />
        <nav aria-label="Main navigation" className="hidden items-center gap-8 lg:flex">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-sm font-semibold text-brand-700">Home</button>
          <button onClick={() => scrollTo('features')} className="text-sm font-medium text-navy-800 transition hover:text-brand-600">Features</button>
          <button onClick={() => scrollTo('how-it-works')} className="text-sm font-medium text-navy-800 transition hover:text-brand-600">How it works</button>
          <button onClick={() => scrollTo('about')} className="text-sm font-medium text-navy-800 transition hover:text-brand-600">About</button>
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          <Button to="/login" variant="secondary" size="md">Login</Button>
          <Button to="/register" variant="navy" size="md">Get Started <ArrowRight aria-hidden="true" /></Button>
        </div>
        <button
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-11 place-items-center rounded-2xl border border-white bg-white/80 text-navy-900 shadow-card sm:hidden"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        {menuOpen && (
          <div className="absolute inset-x-4 top-[calc(100%-0.25rem)] rounded-2xl border border-white bg-white/95 p-3 shadow-pop backdrop-blur-xl sm:hidden">
            <div className="flex flex-col gap-1">
              {[
                ['Features', 'features'], ['How it works', 'how-it-works'], ['About', 'about'],
              ].map(([label, id]) => <button key={id} onClick={() => scrollTo(id)} className="rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-ice-50">{label}</button>)}
              <Link to="/login" className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-ice-50">Login</Link>
              <Link to="/register" className="rounded-xl bg-navy-900 px-3 py-3 text-sm font-semibold text-white">Get Started</Link>
            </div>
          </div>
        )}
      </header>

      <section className="relative mx-auto grid max-w-[1500px] items-center gap-2 px-4 pb-10 pt-3 sm:px-8 md:pb-16 lg:grid-cols-[0.94fr_1.06fr] lg:px-12 lg:pb-20 lg:pt-5">
        <div aria-hidden="true" className="pointer-events-none absolute -left-48 top-8 size-[28rem] rounded-full bg-brand-200/35 blur-3xl" />
        <div className="relative z-10 py-6 md:py-12 lg:py-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-white bg-white/75 px-3.5 py-2 text-xs font-bold text-brand-700 shadow-card">
            <span className="grid size-5 place-items-center rounded-full bg-accent-400 text-navy-950"><Sparkles className="size-3" /></span>
            YOUR PERSONAL HEALTH COPILOT
          </span>
          <h1 className="mt-6 max-w-2xl text-[2.8rem] leading-[1.0] font-extrabold tracking-[-0.055em] text-navy-900 sm:text-6xl lg:text-[4.7rem] xl:text-[5.3rem]">
            Understand Your Health, <span className="bg-linear-to-r from-brand-700 via-brand-500 to-emerald-400 bg-clip-text text-transparent">Better.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            Bring your medical documents together, explore report details and follow your health journey in one calm, easy-to-use workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button to="/register" size="lg" className="w-full sm:w-auto justify-center">Get Started <ArrowRight aria-hidden="true" /></Button>
            <Button to="/login" variant="secondary" size="lg" className="w-full sm:w-auto justify-center">Login to Account</Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-semibold text-navy-800/80 sm:text-sm">
            <span className="inline-flex items-center gap-2"><Check className="size-4 text-emerald-600" /> Organized records</span>
            <span className="inline-flex items-center gap-2"><Check className="size-4 text-emerald-600" /> Plain-language context</span>
            <span className="inline-flex items-center gap-2"><Check className="size-4 text-emerald-600" /> Secure multi-tenant access</span>
          </div>
        </div>

        <div className="relative mx-auto min-h-[390px] w-full max-w-[720px] sm:min-h-[490px] lg:min-h-[560px]">
          <div aria-hidden="true" className="absolute inset-[8%_3%_5%_4%] rounded-[40%] bg-linear-to-br from-white via-brand-100 to-brand-200/80 blur-[1px]" />
          <div aria-hidden="true" className="absolute right-[8%] top-[4%] size-20 rounded-full border border-white/90 bg-white/40 shadow-card backdrop-blur-xl" />
          <div aria-hidden="true" className="absolute left-[5%] top-[23%] size-12 rounded-2xl border border-white bg-white/70 shadow-card"><PlusDecor /></div>
          <div aria-hidden="true" className="absolute right-[14%] bottom-[17%] size-14 rounded-full border border-white bg-brand-100/80 shadow-card" />
          <SafeImage
            src="/images/lungs.png"
            alt="Blue medical illustration of lungs"
            className="absolute inset-y-[3%] right-[2%] w-[64%] sm:right-[2%] sm:w-[68%]"
            imgClassName="size-full object-contain drop-shadow-[0_24px_35px_rgb(27_124_191/0.17)]"
          />
          <SafeImage
            src="/images/doctor.png"
            alt="Doctor representing the HealthSaathi care experience"
            className="absolute bottom-[2%] left-[3%] h-[90%] w-[55%] sm:left-[8%] sm:w-[52%]"
            imgClassName="size-full object-contain object-bottom drop-shadow-[0_20px_35px_rgb(27_70_120/0.16)]"
          />
          <div className="glass absolute left-[1%] top-[10%] flex items-center gap-3 rounded-2xl px-4 py-3 sm:left-[3%] sm:px-5">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-100 text-brand-700"><FileText className="size-5" /></span>
            <span><span className="block text-xs font-extrabold text-navy-900 sm:text-sm">Upload Reports</span><span className="mt-0.5 block text-[10px] text-muted sm:text-xs">PDFs, scans & prescriptions</span></span>
          </div>
          <div className="glass absolute right-[0%] top-[36%] flex items-center gap-2.5 rounded-full px-3 py-2 sm:right-[1%] sm:gap-3 sm:px-4 sm:py-3">
            <span className="grid size-9 place-items-center rounded-full bg-accent-400 text-navy-950"><ShieldCheck className="size-4" /></span>
            <span className="text-[10px] font-bold leading-tight text-navy-900 sm:text-xs">One organized<br />health workspace</span>
          </div>
          <div className="glass absolute bottom-[5%] left-[27%] flex items-center gap-3 rounded-2xl px-4 py-3 sm:left-[31%] sm:px-5">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Activity className="size-5" /></span>
            <span><span className="block text-xs font-extrabold text-navy-900 sm:text-sm">Health timeline</span><span className="mt-0.5 block text-[10px] text-muted sm:text-xs">See the bigger picture</span></span>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-8 border-y border-white/70 bg-white/45 py-12 backdrop-blur-sm sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[1500px] px-5 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-extrabold tracking-[0.18em] text-brand-700 uppercase">One place for the important details</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">Your health information, <span className="text-brand-600">more connected.</span></h2>
            <p className="mt-4 text-sm leading-6 text-muted sm:text-base">A thoughtfully designed space to organize documents, review sample insights and prepare for better healthcare conversations.</p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {features.map(({ icon: Icon, title, description }, index) => (
              <article key={title} className="panel group p-5 transition duration-200 hover:-translate-y-1 hover:shadow-pop sm:p-6">
                <span className={`grid size-12 place-items-center rounded-2xl ${index % 2 ? 'bg-accent-300/60 text-navy-900' : 'bg-brand-100 text-brand-700'}`}><Icon className="size-5" aria-hidden="true" /></span>
                <h3 className="mt-5 text-base font-extrabold text-navy-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
                <button onClick={() => navigate('/register')} className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-700 transition group-hover:gap-2">Explore <ChevronRight className="size-4" /></button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="organ-title" className="mx-auto max-w-[1500px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl"><p className="text-xs font-extrabold tracking-[0.18em] text-brand-700 uppercase">Explore by focus area</p><h2 id="organ-title" className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">A clearer view of every report.</h2></div>
          <p className="max-w-lg text-sm leading-6 text-muted">Organ-specific cards help group relevant information. They are educational entry points, not diagnosis tools.</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {organs.map((organ, index) => (
            <article key={organ.title} className={`group relative flex min-h-[245px] flex-col overflow-hidden rounded-3xl border border-white p-4 shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-pop sm:min-h-[300px] sm:p-6 ${index === 2 ? 'bg-linear-to-br from-brand-700 to-brand-500 text-white' : 'bg-white/75 text-navy-900'}`}>
              <div className="relative flex flex-1 items-center justify-center"><img src={organ.image} alt="" loading="lazy" className="h-32 w-full object-contain transition-transform duration-300 group-hover:scale-105 sm:h-44" /></div>
              <h3 className={`mt-4 text-sm font-extrabold sm:text-base ${index === 2 ? 'text-white' : 'text-navy-900'}`}>{organ.title}</h3>
              <p className={`mt-1 text-xs leading-5 sm:text-sm ${index === 2 ? 'text-white/80' : 'text-muted'}`}>{organ.copy}</p>
              <button type="button" onClick={() => navigate('/register')} aria-label={`Explore ${organ.title}`} className={`absolute right-4 top-4 grid size-9 place-items-center rounded-full transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${index === 2 ? 'bg-white text-navy-900' : 'bg-accent-400 text-navy-950'}`}><ArrowRight className="size-4" /></button>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-8 mx-auto max-w-[1500px] px-5 pb-12 sm:px-8 sm:pb-16 lg:px-12 lg:pb-20">
        <div className="relative overflow-hidden rounded-[32px] border border-white bg-linear-to-br from-white/90 via-brand-50 to-brand-100/80 p-6 shadow-card sm:p-10 lg:p-12">
          <div aria-hidden="true" className="absolute -right-20 -top-28 size-80 rounded-full bg-brand-200/50 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-12">
            <div><p className="text-xs font-extrabold tracking-[0.18em] text-brand-700 uppercase">How it works</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">Less searching.<br />More understanding.</h2><p className="mt-4 max-w-md text-sm leading-6 text-muted">HealthSaathi brings your records into one organized experience so you can review information and prepare for conversations with your healthcare provider.</p><Button to="/register" className="mt-6">Get Started <ArrowRight aria-hidden="true" /></Button></div>
            <ol className="grid gap-3 sm:grid-cols-3">
              {steps.map((step) => <li key={step.n} className="rounded-2xl border border-white/90 bg-white/75 p-4 sm:p-5"><span className="text-3xl font-extrabold tracking-tight text-brand-200">{step.n}</span><h3 className="mt-4 text-sm font-extrabold text-navy-900">{step.title}</h3><p className="mt-2 text-xs leading-5 text-muted">{step.text}</p></li>)}
            </ol>
          </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-8 border-t border-white/80 bg-white/45 px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1500px] flex-col justify-between gap-6 md:flex-row md:items-center">
          <div><Logo /><p className="mt-3 max-w-md text-xs leading-5 text-muted">A personal health workspace concept designed to make medical information easier to organize and explore.</p></div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-navy-800"><button onClick={() => scrollTo('features')} className="hover:text-brand-600">Features</button><button onClick={() => scrollTo('how-it-works')} className="hover:text-brand-600">How it works</button><Link to="/login" className="hover:text-brand-600">Login</Link><Link to="/register" className="hover:text-brand-600">Get started</Link></div>
          <p className="max-w-sm text-[11px] leading-5 text-muted">Demo notice: Sample information and explanations are fictional. HealthSaathi AI does not provide medical diagnoses and is not a substitute for qualified medical advice.</p>
        </div>
      </section>

    </main>
  )
}

function PlusDecor() {
  return <Stethoscope className="m-auto size-5 text-brand-700" aria-hidden="true" />
}
