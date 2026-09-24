import { useState } from 'react'
import ContactIcon, { type ContactIconName } from './ContactIcon'
import { CONTACT_EMAIL, WHATSAPP_DISPLAY, WHATSAPP_URL } from '../../lib/contact'

/** One channel: icon + value open it (mailto / WhatsApp); the button on the right copies the value. */
function ContactRow({ icon, value, href, onOpen }: { icon: ContactIconName; value: string; href: string; onOpen: () => void }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (insecure origin / permissions) — the link itself still works.
    }
  }

  return (
    <div className="flex items-center gap-1">
      <a
        role="menuitem"
        href={href}
        onClick={onOpen}
        {...(href.startsWith('http') && { target: '_blank', rel: 'noopener noreferrer' })}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-black/5"
      >
        <ContactIcon name={icon} className="h-5 w-5" />
        <span className="truncate">{value}</span>
      </a>
      <button
        onClick={copy}
        aria-label={copied ? 'Copied' : `Copy ${value}`}
        title={copied ? 'Copied' : 'Copy'}
        className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-black/5 ${copied ? 'text-brand' : 'text-ink/50 hover:text-ink'}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
          {copied ? (
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          ) : (
            <>
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V6a2 2 0 0 1 2-2h8" />
            </>
          )}
        </svg>
      </button>
    </div>
  )
}

/** Signed-in "Contact us" button: opens a small card with the email and WhatsApp number. */
export default function ContactMenu() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div className="relative" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="cursor-pointer whitespace-nowrap rounded-lg border-2 border-black bg-white px-3 py-1 text-sm font-medium text-ink transition-colors hover:bg-black/5"
      >
        Contact us
      </button>

      {open && (
        <>
          {/* Click-away layer */}
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            role="menu"
            className="fixed inset-x-4 top-16 z-50 divide-y divide-black/5 rounded-xl border border-black/10 bg-white p-1 shadow-lg sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80"
          >
            <ContactRow icon="mail" value={CONTACT_EMAIL} href={`mailto:${CONTACT_EMAIL}`} onOpen={close} />
            <ContactRow icon="whatsapp" value={WHATSAPP_DISPLAY} href={WHATSAPP_URL} onOpen={close} />
          </div>
        </>
      )}
    </div>
  )
}
