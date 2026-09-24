// Public contact details — shared by the footer (signed out) and the Contact menu (signed in).
export const CONTACT_EMAIL = 'hamzatahir.dev.ai@gmail.com'
export const WHATSAPP_DISPLAY = '0332-7172044'
// wa.me wants the international form: country code (92) + number without the leading 0.
export const WHATSAPP_URL = 'https://wa.me/923327172044'
export const REPO_URL = 'https://github.com/hamzatahir06/Veritas-Ai'

/** Web links open in a new tab; mailto: links don't (a new tab there is just left blank). */
export const linkTarget = (href: string) =>
  href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {}
