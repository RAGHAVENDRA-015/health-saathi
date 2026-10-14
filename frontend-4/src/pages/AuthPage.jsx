import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, Eye, EyeOff, FileText,
  HeartPulse, ShieldCheck, Sparkles,
} from 'lucide-react'
import { Button } from '../components/common/Button.jsx'
import { Logo } from '../components/layout/Logo.jsx'
import { SafeImage } from '../components/common/SafeImage.jsx'
import { useHealthData } from '../context/HealthDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

export default function AuthPage({ mode = 'login' }) {
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useHealthData()
  const { login, loginWithGoogle, register, resetPassword } = useAuth()
  const { notify } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', consent: false })
  useDocumentTitle(isForgot ? 'Reset password' : isRegister ? 'Create account' : 'Login')

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')
    const email = form.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Enter a valid email address to continue.')
      return
    }
    if (isForgot) {
      try {
        setIsSubmitting(true)
        await resetPassword(email)
        setMessage('Password reset instructions sent. Please check your inbox.')
        notify({ title: 'Password reset sent', description: 'Check your email inbox for instructions.' })
      } catch (err) {
        setMessage(err.message || 'Password reset request failed.')
      } finally {
        setIsSubmitting(false)
      }
      return
    }
    if (form.password.length < 6) {
      setMessage('Use at least 6 characters in the password field.')
      return
    }
    if (isRegister && !form.name.trim()) {
      setMessage('Enter your name to create an account.')
      return
    }
    if (isRegister && form.password !== form.confirmPassword) {
      setMessage('The passwords do not match.')
      return
    }

    try {
      setIsSubmitting(true)
      if (isRegister) {
        await register({
          name: form.name.trim(),
          email,
          password: form.password,
          demo: false,
        })
        notify({ title: 'Account created', description: 'Connected to HealthSaathi AI backend.' })
      } else {
        await login({
          email,
          password: form.password,
          demo: false,
        })
      }
      navigate('/dashboard', { replace: true, state: { from: location.pathname } })
    } catch (err) {
      console.warn('[AuthPage] Live auth error:', err)
      setMessage(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setMessage('')
    try {
      setIsSubmitting(true)
      await loginWithGoogle()
      navigate('/dashboard', { replace: true, state: { from: location.pathname } })
    } catch (err) {
      console.warn('[AuthPage] Google sign-in:', err)
      const isConfigIssue = err.message?.includes('Client ID') || err.message?.includes('not configured')
      if (isConfigIssue) {
        notify({
          title: 'Google OAuth Setup Required',
          description: 'To enable live Google Sign-In, configure VITE_GOOGLE_CLIENT_ID and enable Google sign-in in Firebase Console.',
          tone: 'info',
        })
        setMessage('Google Sign-In setup: please verify VITE_GOOGLE_CLIENT_ID in frontend-4/.env and enable Google sign-in in Firebase Console.')
      } else {
        setMessage(err.message || 'Google sign-in could not be completed.')
        notify({
          title: 'Google Sign-In',
          description: err.message || 'Sign in was cancelled or could not be completed.',
          tone: 'error',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen p-3 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-6xl overflow-hidden rounded-[30px] border border-white/90 bg-white/75 shadow-pop backdrop-blur-2xl sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="relative flex flex-col justify-between overflow-hidden bg-linear-to-br from-[#d7efff] via-[#eaf7ff] to-[#bfdfff] p-6 sm:p-9 lg:p-12">
          <div aria-hidden="true" className="absolute -right-24 top-10 size-72 rounded-full bg-white/60 blur-3xl" />
          <div className="relative"><Logo /></div>
          <div className="relative py-8">
            <div className="relative mx-auto max-w-md">
              <div className="absolute inset-[12%] rounded-full bg-white/70 blur-2xl" />
              <SafeImage src="/images/doctor.png" alt="Healthcare professional" className="relative mx-auto h-52 w-full sm:h-64 lg:h-72" imgClassName="size-full object-contain" />
              <SafeImage src="/images/lungs.png" alt="Medical illustration of lungs" className="absolute -right-1 top-2 h-32 w-32 sm:right-0 sm:h-40 sm:w-40" imgClassName="size-full object-contain drop-shadow-[0_12px_22px_rgb(20_93_168/0.18)]" />
              <div className="glass absolute bottom-1 left-1 flex items-center gap-2 rounded-2xl px-3 py-2 sm:left-3 sm:px-4 sm:py-3">
                <span className="grid size-9 place-items-center rounded-xl bg-accent-400 text-navy-950"><ShieldCheck className="size-4" /></span>
                <span className="text-xs font-bold text-navy-900">A clearer health journey</span>
              </div>
            </div>
            <h1 className="mt-8 max-w-lg text-3xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-4xl">Better health starts with a <span className="text-brand-600">clearer picture.</span></h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-navy-800/80">Bring your medical documents together and explore the information you already have, in one thoughtfully designed space.</p>
            <ul className="mt-5 space-y-3">
              {['Keep reports organized in one place', 'Review report details with helpful context', 'Prepare questions for your healthcare provider'].map((item) => <li key={item} className="flex items-start gap-2.5 text-xs font-semibold text-navy-800/80"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white text-emerald-600"><Check className="size-3" /></span>{item}</li>)}
            </ul>
          </div>
          <p className="relative text-[10px] leading-5 text-navy-800/70">Protected with enterprise Firebase Authentication and secure cloud storage.</p>
        </aside>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <Link to="/" className="inline-flex items-center gap-2 rounded-full text-sm font-bold text-brand-700 transition hover:text-brand-600"><ArrowLeft className="size-4" /> Back to home</Link>
            <div className="mt-7">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-extrabold text-brand-700"><Sparkles className="size-3.5" /> Welcome to HealthSaathi</span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">{isForgot ? 'Reset password' : isRegister ? 'Create your account' : 'Welcome back!'}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{isForgot ? 'Enter your email address to receive password reset instructions.' : isRegister ? 'Create an account to start managing your personal health workspace.' : 'Sign in to access your personal health workspace.'}</p>
            </div>

            {!isForgot && (
              <div className="mt-7">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleGoogleSignIn}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-ice-200 bg-white px-4 py-3.5 text-sm font-bold text-navy-900 shadow-xs transition hover:border-brand-300 hover:bg-ice-50/70 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="relative my-5 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-ice-200" />
                  </div>
                  <span className="relative bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                    or continue with email
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className={isForgot ? 'mt-7 space-y-4' : 'space-y-4'} noValidate>
              {isRegister && <Field label="Full name"><input autoComplete="name" value={form.name} onChange={(event) => setField('name', event.target.value)} required className="field" placeholder="Enter your full name" /></Field>}
              <Field label="Email address"><input autoComplete="email" type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} required className="field" placeholder="you@example.com" /></Field>
              {!isForgot && <Field label="Password"><span className="relative block"><input autoComplete={isRegister ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} minLength={6} value={form.password} onChange={(event) => setField('password', event.target.value)} required className="field pr-12" placeholder="At least 6 characters" /><button type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted transition hover:bg-ice-100 hover:text-navy-900">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></Field>}
              {isRegister && <Field label="Confirm password"><input autoComplete="new-password" type="password" value={form.confirmPassword} onChange={(event) => setField('confirmPassword', event.target.value)} required className="field" placeholder="Re-enter your password" /></Field>}
              {!isRegister && !isForgot && <div className="flex justify-end"><Link to="/forgot-password" className="text-xs font-bold text-brand-700 hover:underline">Forgot password?</Link></div>}
              {message && (
                <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs leading-5 text-amber-950 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <div className="flex-1">
                      <p className="font-semibold text-amber-900">{message}</p>
                    </div>
                  </div>
                </div>
              )}
              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full justify-center">
                {isSubmitting ? 'Connecting...' : isForgot ? 'Send Recovery Link' : isRegister ? 'Create Account' : 'Sign In'} <ArrowRight aria-hidden="true" />
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted">{isForgot ? <>Remembered your password? <Link to="/login" className="font-bold text-brand-700 hover:underline">Back to login</Link></> : isRegister ? <>Already have an account? <Link to="/login" className="font-bold text-brand-700 hover:underline">Log in</Link></> : <>New to HealthSaathi? <Link to="/register" className="font-bold text-brand-700 hover:underline">Create an account</Link></>}</p>
            <p className="mt-6 flex items-center justify-center gap-2 text-center text-[10px] leading-5 text-muted"><FileText className="size-3.5 shrink-0" /> HealthSaathi AI provides clinical health insights and is not a substitute for professional medical advice.</p>
          </div>
        </section>
      </div>
    </main>
  )
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-navy-800">{label}</span>{children}</label>
}
