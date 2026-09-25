import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { joinWaitlist } from '../lib/api'
import Footer from '../components/shell/Footer'
import { usePageContext } from '../hooks/usePageContext'

/** Real-time "looks like an email" check; the server (pydantic EmailStr) is authoritative. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Phase = 'idle' | 'form' | 'submitting' | 'done'

/** One feature row. `soon` marks a line that is planned but not shipped yet. */
function Feature({ children, soon = false }: { children: ReactNode; soon?: boolean }) {
  return (
    <li className={`flex items-start gap-3 ${soon ? 'text-ink/45' : ''}`}>
      <span className={`font-bold ${soon ? 'text-ink/25' : 'text-brand'}`}>✓</span>
      <span>
        {children}
        {soon && (
          <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink/50 uppercase">
            Coming soon
          </span>
        )}
      </span>
    </li>
  )
}

/** A plan card's content above its button: name + badge, blurb, monthly price, feature list. */
function PlanBody({ name, badge, badgeClass, blurb, price, children }: {
  name: string
  badge: string
  badgeClass: string
  blurb: string
  price: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-ink">{name}</h2>
        <span className={badgeClass}>{badge}</span>
      </div>
      <p className="mt-2 text-xs text-ink/60">{blurb}</p>

      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold text-ink">{price}</span>
        <span className="text-sm font-medium text-ink/50">/ month</span>
      </div>

      <div className="my-6 border-t border-black/5" />

      <ul className="space-y-3.5 text-sm text-ink/80">{children}</ul>
    </div>
  )
}

export default function Pricing() {
  const { isSignedIn, accessToken, user } = usePageContext()
  const [phase, setPhase] = useState<Phase>('idle')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailValid = EMAIL_RE.test(email.trim())

  // `email` present → signed-out path; absent → signed-in (token) path.
  const submit = async (payload: { email?: string; accessToken?: string }) => {
    setPhase('submitting')
    setError(null)
    try {
      await joinWaitlist(payload)
      setPhase('done')
    } catch {
      setError('Something went wrong — please try again.')
      setPhase(payload.email !== undefined ? 'form' : 'idle')
    }
  }

  const handleWaitlist = () => {
    if (isSignedIn) submit({ accessToken })
    else setPhase('form')
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#fafafa]">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 text-center">
        <h1 className="font-serif text-3xl font-bold text-ink sm:text-4xl">
          Research deeper. Export faster.
        </h1>
        <p className="mt-3 text-base text-ink/60 sm:text-lg">
          Automate your literature reviews and research briefs without sacrificing accuracy.
        </p>

        {/* Pricing Cards Container */}
        <div className="mt-12 grid gap-8 text-left md:grid-cols-2 md:items-stretch">

          {/* 1. FREE PLAN */}
          <div className="flex flex-col justify-between rounded-2xl border border-black/10 bg-white p-6 shadow-xs sm:p-8">
            <PlanBody
              name="Free Starter"
              badge="Free Forever"
              badgeClass="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-ink/70"
              blurb="A brief a day — fully cited, saved, and exportable."
              price="$0"
            >
              <Feature>
                <strong>3 research briefs</strong> per day
              </Feature>
              <Feature>Web search and peer-reviewed literature, on every run</Feature>
              <Feature>IEEE citations at the claim, with the full source list</Feature>
              <Feature>PDF and Word (.docx) download of every brief</Feature>
              <Feature>Saved projects and a searchable source library</Feature>
            </PlanBody>

            <Link
              to="/"
              className="mt-8 block w-full rounded-xl border border-black/10 bg-black/5 py-3 text-center text-sm font-semibold text-ink transition-colors hover:bg-black/10"
            >
              Start Researching Free
            </Link>
          </div>

          {/* 2. PRO PLAN ($9/mo) */}
          <div className="relative flex flex-col justify-between rounded-2xl border-2 border-brand bg-white p-6 shadow-md sm:p-8">
            {/* Highlight Badge */}
            <div className="absolute -top-3.5 right-6 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white uppercase tracking-wider">
              Most Popular
            </div>

            <PlanBody
              name="Pro Researcher"
              badge="$9 / mo"
              badgeClass="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand"
              blurb="For the weeks the research doesn't stop — same depth on every brief, far more of them."
              price="$9"
            >
              <Feature>
                <strong>18 research briefs</strong> per day — 6× the free cap
              </Feature>
              <Feature>
                <strong>Everything in Free Starter</strong> — same search depth, same citations,
                same PDF and Word export, on every one of them
              </Feature>
              <Feature>
                <strong>Guaranteed capacity at peak times</strong> — your runs stay on the top
                research model instead of falling back to the lighter one
              </Feature>
              <Feature soon>
                Source-list export (BibTeX / CSV) for Zotero, Mendeley, and EndNote
              </Feature>
            </PlanBody>

            <div className="mt-8">
              {phase === 'done' ? (
                <div className="w-full rounded-xl bg-emerald-700 py-3 text-center text-sm font-semibold text-white">
                  ✓ You are on the Pro Waitlist!
                </div>
              ) : (phase === 'form' || phase === 'submitting') && !isSignedIn ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (emailValid) submit({ email: email.trim() })
                  }}
                >
                  <div className="flex gap-2">
                    <input
                      type="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched(true)}
                      placeholder="you@example.com"
                      className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-3 py-3 text-sm text-ink outline-none placeholder:text-ink/40 focus:border-brand"
                    />
                    <button
                      type="submit"
                      disabled={!emailValid || phase === 'submitting'}
                      className="shrink-0 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors cursor-pointer hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {phase === 'submitting' ? 'Joining…' : 'Join'}
                    </button>
                  </div>
                  {touched && email && !emailValid && (
                    <p className="text-xs font-medium text-red-600">Enter a valid email address.</p>
                  )}
                  <p className="text-xs text-ink/50">
                    Pro sign-in uses Google — use an email you can sign in to Google with.
                  </p>
                  {error && <p className="text-xs font-medium text-red-600">{error}</p>}
                </form>
              ) : (
                <>
                  <button
                    onClick={handleWaitlist}
                    disabled={phase === 'submitting'}
                    className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-colors cursor-pointer hover:bg-brand-dark disabled:opacity-60"
                  >
                    {phase === 'submitting' ? 'Joining…' : 'Join Pro Waitlist ($9/mo)'}
                  </button>
                  {isSignedIn && user?.email && (
                    <p className="mt-2 text-center text-xs text-ink/50">Joins as {user.email}</p>
                  )}
                  {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
                </>
              )}
            </div>
          </div>

        </div>

        <p className="mx-auto mt-8 max-w-2xl text-xs text-ink/40">
          Daily limits reset every 24 hours and reflect real capacity on the search and model
          providers behind each brief. You can run a brief without an account — signing in is what
          saves it and unlocks the downloads. Pro isn't live yet: joining the waitlist is free, takes
          no card, and we'll email you when it opens.
        </p>
      </div>
      {!isSignedIn && <Footer />}
    </div>
  )
}
