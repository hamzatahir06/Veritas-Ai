import { useMemo, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { API_BASE, authHeader, jsonHeaders, type DoneEvent, type Source } from '../../lib/api'
import { PdfIcon, WordIcon } from './DocumentIcons'
import Spinner from '../shell/Spinner'

type ResultViewProps = {
  result: DoneEvent
  accessToken?: string
}

/** A centred status line in the blank tab that will show the PDF. */
function showTabMessage(tab: Window, text: string, color: string) {
  tab.document.body.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; color:${color};">${text}</div>`
}

const CITE_HREF = '#cite-'

type DocFormat = 'docx' | 'pdf'
type DocAction = 'download' | 'view'

/** The export cards: one entry per format, in brand colours (Adobe red, Word blue). */
const EXPORTS: {
  format: DocFormat
  name: string
  blurb: string
  Icon: typeof PdfIcon
  actions: DocAction[]
  tone: { card: string; name: string; blurb: string; stripe: string; primary: string; secondary: string }
}[] = [
  {
    format: 'pdf',
    name: 'Adobe PDF',
    blurb: 'Preserves rigid formatting for printing',
    Icon: PdfIcon,
    actions: ['view', 'download'],
    tone: {
      card: 'border-[#FA0F00] from-red-50',
      name: 'text-red-900',
      blurb: 'text-red-800',
      stripe: 'bg-[#FA0F00]',
      primary: 'bg-red-600 text-white hover:bg-red-700',
      secondary: 'border border-red-300 bg-white text-red-700 hover:border-red-400 hover:bg-red-50',
    },
  },
  {
    format: 'docx',
    name: 'Microsoft Word',
    blurb: 'Fully editable document (.docx)',
    Icon: WordIcon,
    actions: ['download'],
    tone: {
      card: 'border-[#185ABD] from-blue-50',
      name: 'text-blue-900',
      blurb: 'text-blue-800',
      stripe: 'bg-[#185ABD]',
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      secondary: 'border border-blue-300 bg-white text-blue-700 hover:bg-blue-50',
    },
  },
]

/**
 * The model is told to leave the brief's own "## Sources" section empty (the
 * list below and the document writers rebuild it from real results), so a
 * trailing empty heading would only duplicate "Sources & Citations".
 */
const dropEmptySourcesHeading = (md: string) => md.replace(/\n#{1,3}\s*(?:Sources|References)\s*$/i, '\n')

/**
 * Mark IEEE citations like "[3]" as links; the `a` renderer below points each
 * one at its source's URL. A number with no source entry can't link anywhere,
 * so it is dropped with the separator before it rather than left as dead
 * text. An existing markdown link or reference definition ("[3](…)", "[3]:")
 * is left alone. 【n】 is accepted too: briefs saved before the backend normalised it.
 */
function linkCitations(md: string, sourceCount: number): string {
  return md.replace(/(\s*,?\s*)(?:\[(\d+)\]|【\s*(\d+)[^】]*】)(?![(:])/g,
    (_match, separator: string, bracket?: string, lenticular?: string) => {
      const n = Number(bracket ?? lenticular)
      return n >= 1 && n <= sourceCount ? `${separator}[\\[${n}\\]](${CITE_HREF}${n})` : ''
    })
}

export default function ResultView({ result, accessToken }: ResultViewProps) {
  // Memoised together: the citation rewrite and the link renderer both index
  // into this list, and ReactMarkdown re-parses whenever either changes.
  const { uniqueSources, briefMarkdown, markdownComponents } = useMemo(() => {
    const uniqueSources: Source[] = Array.from(
      new Map((result.sources ?? []).map((s) => [s.url, s] as const)).values(),
    )
    const markdownComponents: Components = {
      // Wide tables scroll inside the card instead of stretching it on phones.
      table: ({ children }) => (
        <div className="overflow-x-auto">
          <table>{children}</table>
        </div>
      ),
      a: ({ href, children }) => {
        if (href?.startsWith(CITE_HREF)) {
          const source = uniqueSources[Number(href.slice(CITE_HREF.length)) - 1]
          return (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              title={source.title || source.url}
              className="text-brand-dark no-underline hover:underline"
            >
              {children}
            </a>
          )
        }
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        )
      },
    }
    return {
      uniqueSources,
      briefMarkdown: linkCitations(dropEmptySourcesHeading(result.markdown || ''), uniqueSources.length),
      markdownComponents,
    }
  }, [result.markdown, result.sources])

  const isGuest = !result.project_id || !accessToken
  // Which document button is working (e.g. "pdf-view"), and the last failure to show.
  const [busy, setBusy] = useState<string | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(result.markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard blocked (insecure origin / permissions) — the downloads still work.
    }
  }

  /**
   * Fetch the brief as a .pdf / .docx and open or save it. Signed-in users get
   * the copy stored with their project; guests have it rendered on the fly by
   * the same backend writers (nothing is saved), so both get one document.
   */
  const openDocument = async (format: DocFormat, action: DocAction) => {
    if (busy) return
    setBusy(`${format}-${action}`)
    setDocError(null)
    // Opened before the fetch: a tab opened after an await is blocked as a popup.
    const viewerTab = action === 'view' ? window.open('', '_blank') : null
    if (viewerTab) {
      viewerTab.document.title = 'Loading PDF…'
      showTabMessage(viewerTab, 'Preparing your document…', '#666')
    }

    try {
      const res = isGuest
        ? await fetch(`${API_BASE}/api/documents/${format}`, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({
              topic: result.topic,
              markdown: result.markdown,
              sources: result.sources,
              provider: result.provider,
            }),
          })
        : await fetch(`${API_BASE}/api/projects/${result.project_id}/download/${format}`, {
            headers: authHeader(accessToken!),
          })
      if (!res.ok) throw new Error(`Document request failed (${res.status})`)

      const blob = await res.blob()
      if (viewerTab) {
        const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
        viewerTab.location.href = blobUrl
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000)
        return
      }

      const named = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')
      const fallback = (result.topic || 'research-brief').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40)
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = named?.[1] ?? `${fallback}.${format}`
      a.click()
      // Revoking in the same tick can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      console.error(err)
      if (viewerTab) showTabMessage(viewerTab, "Couldn't load the document. Please try again.", '#dc2626')
      else setDocError(`Couldn't prepare the ${format === 'pdf' ? 'PDF' : 'Word document'} — please try again.`)
    } finally {
      setBusy(null)
    }
  }

  /** Button content: a spinner + working label while this exact button is busy. */
  const docLabel = (format: DocFormat, action: DocAction, idle: string) =>
    busy === `${format}-${action}` ? (
      <span className="flex items-center justify-center gap-2">
        <Spinner className="h-3.5 w-3.5 border-current/25 border-t-current" />
        {action === 'view' ? 'Opening…' : 'Preparing…'}
      </span>
    ) : (
      idle
    )

  return (
    <div className="animate-fade-up rounded-2xl border border-black/15 bg-white p-4 shadow-sm sm:p-7">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={copyBrief}
          aria-live="polite"
          className={`ui-chrome flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
            copied ? 'border-brand/40 bg-brand/10 text-brand-dark' : 'border-black/20 text-ink/80 hover:bg-black/5 hover:text-ink'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5">
            {copied ? (
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            ) : (
              <>
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V6a2 2 0 0 1 2-2h8" />
              </>
            )}
          </svg>
          {copied ? 'Copied' : 'Copy brief'}
        </button>
      </div>

      {/* Brief Body */}
      <div className="markdown-content text-ink">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{briefMarkdown}</ReactMarkdown>
      </div>

      {/* Sources & Citations */}
      {uniqueSources.length > 0 && (
        <div className="mt-8 border-t border-black/10 pt-6">
          <div className="mb-3 text-sm font-semibold text-ink">Sources & Citations</div>
          <ol className="flex flex-col gap-2">
            {uniqueSources.map((s, i) => (
              <li key={i} className="flex gap-1.5 text-sm">
                <span className="shrink-0 tabular-nums text-ink/70">[{i + 1}]</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 wrap-anywhere text-brand-dark underline decoration-brand/40 transition-colors hover:decoration-brand"
                >
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* EXPORT SECTION — a `done` event is always a brief, so this always shows. */}
      <div className="mt-8 flex flex-col gap-3 border-t border-black/5 pt-6">
        <div className="mb-1 text-sm font-semibold text-ink">Export Documents</div>

        <div className="grid gap-3 sm:grid-cols-2">
          {EXPORTS.map(({ format, name, blurb, Icon, actions, tone }) => (
            <div
              key={format}
              className={`flex flex-col overflow-hidden rounded-xl border-2 bg-linear-to-br to-white ${tone.card}`}
            >
              <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                  <Icon className="h-11 w-11 shrink-0" />
                  <div className="min-w-0">
                    <div className={`font-semibold ${tone.name}`}>{name}</div>
                    <div className={`text-xs font-medium ${tone.blurb}`}>{blurb}</div>
                  </div>
                </div>
                <div className="mt-auto flex gap-2">
                  {actions.map((action) => (
                    <button
                      key={action}
                      onClick={() => openDocument(format, action)}
                      disabled={busy !== null}
                      className={`flex-1 cursor-pointer rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-all disabled:cursor-wait disabled:opacity-70 ${
                        action === 'download' ? tone.primary : tone.secondary
                      }`}
                    >
                      {docLabel(format, action, action === 'view' ? 'View' : 'Download')}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`h-2 ${tone.stripe}`} aria-hidden="true" />
            </div>
          ))}
        </div>

        {docError && (
          <div role="alert" className="animate-fade-up rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700">
            {docError}
          </div>
        )}

        <div className="mt-1 text-center text-xs font-medium text-ink/70">
          {isGuest
            ? 'Guest session: nothing is saved, so download your documents now'
            : 'Saved securely to your project archives'}
        </div>
      </div>
    </div>
  )
}
