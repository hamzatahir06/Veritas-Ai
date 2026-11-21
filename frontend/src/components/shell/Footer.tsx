import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import BrandLogo from './BrandLogo'
import ContactIcon, { type ContactIconName } from './ContactIcon'
import { CONTACT_EMAIL, REPO_URL, WHATSAPP_DISPLAY, WHATSAPP_URL, linkTarget } from '../../lib/contact'

type FooterLink = { label: string; to: string; external?: boolean }

const linkClass = 'text-sm text-white/70 transition-colors hover:text-brand'
const headingClass = 'text-xs font-semibold tracking-[0.14em] text-white uppercase'

function Column({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className={headingClass}>{title}</h3>
      <ul className="mt-5 space-y-3">
        {links.map(({ label, to, external }) => (
          <li key={label}>
            {external ? (
              <a href={to} {...linkTarget(to)} className={linkClass}>
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

function ContactRow({ icon, href, children }: { icon: ContactIconName; href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      {...linkTarget(href)}
      className="group flex items-center gap-3 text-sm text-white/70 transition-colors hover:text-white"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white/80 transition-colors group-hover:border-brand/60 group-hover:text-brand">
        <ContactIcon name={icon} />
      </span>
      <span className="min-w-0 wrap-anywhere">{children}</span>
    </a>
  )
}

/** Site-wide footer for the scrollable (non-chat) pages. */
export default function Footer() {
  // Signed-out only, so Sources is the landing-page section rather than the /sources page.
  const product: FooterLink[] = [
    { label: 'Home', to: '/' },
    { label: 'Sources', to: '/#sources' },
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

      <div className="mx-auto max-w-6xl px-5 pt-12 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <Link to="/" className="inline-flex">
              <BrandLogo onDark />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
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

          <div className="grid grid-cols-2 gap-8 lg:col-span-4">
            <Column title="Product" links={product} />
            <Column title="Resources" links={resources} />
          </div>

          <div className="lg:col-span-4">
            <h3 className={headingClass}>Get in touch</h3>
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

        <p className="mt-12 border-t border-white/15 pt-6 text-xs text-white/55">
          © {new Date().getFullYear()} Veritas AI. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
