import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import BrandLogo from './BrandLogo'

const CONTACT_EMAIL = 'hamzatahir.dev.ai@gmail.com'
const WHATSAPP_DISPLAY = '0332-7172044'
// wa.me wants the international form: country code (92) + number without the leading 0.
const WHATSAPP_URL = 'https://wa.me/923327172044'
const REPO_URL = 'https://github.com/hamzatahir06/Veritas-Ai'

type FooterLink = { label: string; to: string; external?: boolean }

const linkClass = 'text-sm text-white/55 transition-colors hover:text-brand'

const icons = {
  mail: (
    <path d="M3 5h18v14H3zM3 6l9 7 9-7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  whatsapp: (
    <path
      d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 1a4.5 4.5 0 0 1-2.5-2.5l1-1-1-2L9.5 8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  github: (
    <path
      d="M9 19c-4.5 1.4-4.5-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
}

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4 shrink-0">
      {icons[name]}
    </svg>
  )
}

function Column({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold tracking-[0.14em] text-white uppercase">{title}</h3>
      <ul className="mt-5 space-y-3">
        {links.map(({ label, to, external }) => (
          <li key={label}>
            {external ? (
              <a href={to} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {label}
              </a>
            ) : (
              <Link to={to} className={linkClass}>
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ContactRow({ icon, href, children }: { icon: keyof typeof icons; href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      {...(href.startsWith('http') && { target: '_blank', rel: 'noopener noreferrer' })}
      className="group flex items-center gap-3 text-sm text-white/55 transition-colors hover:text-white"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors group-hover:border-brand/60 group-hover:text-brand">
        <Icon name={icon} />
      </span>
      <span className="break-all">{children}</span>
    </a>
  )
}

/** Site-wide footer for the scrollable (non-chat) pages. */
export default function Footer({ isSignedIn }: { isSignedIn: boolean }) {
  // Signed-out, sources live as a section on the landing page; signed-in, it's a real page.
  const product: FooterLink[] = [
    { label: 'Home', to: '/' },
    { label: 'Sources', to: isSignedIn ? '/sources' : '/#sources' },
    ...(isSignedIn ? [{ label: 'Projects', to: '/projects' }] : []),
    { label: 'Pricing', to: '/pricing' },
  ]

  const resources: FooterLink[] = [
    { label: 'GitHub', to: REPO_URL, external: true },
    { label: 'Report an issue', to: `${REPO_URL}/issues`, external: true },
    { label: 'MIT License', to: `${REPO_URL}/blob/main/LICENSE`, external: true },
  ]

  return (
    <footer className="w-full bg-black text-white">
      {/* Brand-colored hairline across the top edge */}
      <div className="h-px w-full bg-linear-to-r from-transparent via-brand to-transparent" />

      <div className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link to="/" className="inline-flex">
              <BrandLogo onDark />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
              Autonomous research briefs from web and peer-reviewed sources — cited at the claim,
              ready to export as PDF or Word.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Start a brief <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-10 md:col-span-4">
            <Column title="Product" links={product} />
            <Column title="Resources" links={resources} />
          </div>

          <div className="md:col-span-4">
            <h3 className="text-xs font-semibold tracking-[0.14em] text-white uppercase">Get in touch</h3>
            <div className="mt-5 space-y-3">
              <ContactRow icon="mail" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </ContactRow>
              <ContactRow icon="whatsapp" href={WHATSAPP_URL}>
                WhatsApp · {WHATSAPP_DISPLAY}
              </ContactRow>
              <ContactRow icon="github" href={REPO_URL}>
                hamzatahir06/Veritas-Ai
              </ContactRow>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Veritas AI. All rights reserved.</p>
          <p>Briefs are AI-generated — verify key claims against the cited sources.</p>
        </div>
      </div>
    </footer>
  )
}
