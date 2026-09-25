import { useMemo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import type { StreamEvent } from '../../lib/api'
import { PdfIcon, WordIcon } from './DocumentIcons'
import { API_BASE } from '../../lib/api'

type DoneEvent = Extract<StreamEvent, { type: 'done' }>
type Source = DoneEvent['sources'][number]

type ResultViewProps = {
  result: DoneEvent
  accessToken?: string
}

/** A centred status line in the blank tab that will show the PDF. */
function showTabMessage(tab: Window, text: string, color: string) {
  tab.document.body.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; color:${color};">${text}</div>`
}

const CITE_HREF = '#cite-'

/**
 * Mark IEEE citations like "[3]" as links; the `a` renderer below points each
 * one at its source's URL. A number with no source entry can't link anywhere,
 * so it is dropped with the separator before it rather than left as dead
 * text. An existing markdown link or reference definition ("[3](…)", "[3]:")
 * is left alone. 【n】 is accepted too: briefs saved before the backend normalised it.
 */
function linkCitations(md: string, sourceCount: number): string {
  return md.replace(/(\s*,?\s*)(?:\[(\d+)\]|【\s*(\d+)\s*】)(?![(:])/g,
    (_match, separator: string, bracket?: string, lenticular?: string) => {
      const n = Number(bracket ?? lenticular)
      return n >= 1 && n <= sourceCount ? `${separator}[\\[${n}\\]](${CITE_HREF}${n})` : ''
    })
}

export default function ResultView({ result, accessToken }: ResultViewProps) {
  const uniqueSources: Source[] = Array.from(
    new Map((result.sources ?? []).map((s) => [s.url, s] as const)).values(),
  )

  const briefMarkdown = useMemo(
    () => linkCitations(result.markdown || '', uniqueSources.length),
    [result.markdown, uniqueSources.length],
  )

  const markdownComponents: Components = {
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

  // Only render export buttons for actual research outputs
  const isResearchBrief = Boolean(
    uniqueSources.length > 0 || 
    (result.markdown && (result.markdown.includes('#') || result.markdown.length > 350))
  )

  const isGuest = !result.project_id || !accessToken

  /**
   * Fetch the brief as a .pdf / .docx and open or save it. Signed-in users get
   * the copy stored with their project; guests have it rendered on the fly by
   * the same backend writers (nothing is saved), so both get one document.
   */
  const openDocument = async (format: 'docx' | 'pdf', action: 'download' | 'view') => {
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: result.topic,
              markdown: result.markdown,
              sources: result.sources,
              provider: result.provider,
            }),
          })
        : await fetch(`${API_BASE}/api/projects/${result.project_id}/download/${format}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
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
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error(err)
      if (viewerTab) showTabMessage(viewerTab, "Couldn't load the document. Please try again.", '#dc2626')
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      {/* Brief Body */}
      <div className="markdown-content text-ink/90">
        <ReactMarkdown components={markdownComponents}>{briefMarkdown}</ReactMarkdown>
      </div>

      {/* Sources & Citations */}
      {uniqueSources.length > 0 && (
        <div className="mt-8 border-t border-black/5 pt-6">
          <div className="mb-3 text-sm font-semibold text-ink">Sources & Citations</div>
          <ol className="flex flex-col gap-2">
            {uniqueSources.map((s, i) => (
              <li key={i} className="text-sm">
                <span className="mr-1.5 text-ink/50">[{i + 1}]</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-dark underline decoration-brand/40 hover:decoration-brand"
                >
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* EXPORT SECTION */}
      {isResearchBrief && (
        <div className="mt-8 flex flex-col gap-3 border-t border-black/5 pt-6">
          <div className="mb-1 text-sm font-semibold text-ink">Export Documents</div>

          {/* Premium PDF Card */}
          <div className="relative overflow-hidden rounded-xl border-2 border-[#FA0F00] bg-gradient-to-br from-red-50 to-white px-4 pt-4">
            <div className="flex flex-col items-center justify-between gap-4 pb-4 sm:flex-row">
              <div className="flex items-center gap-4">
                <PdfIcon className="h-12 w-12 shrink-0" />
                <div>
                  <div className="font-semibold text-red-900">Adobe PDF</div>
                  <div className="text-xs font-medium text-red-700/80">Preserves rigid formatting for printing</div>
                </div>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  onClick={() => openDocument('pdf', 'view')}
                  className="flex-1 cursor-pointer rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition-all hover:border-red-400 hover:bg-red-50 sm:flex-none"
                >
                  View
                </button>
                <button
                  onClick={() => openDocument('pdf', 'download')}
                  className="flex-1 cursor-pointer rounded-lg border border-transparent bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow sm:flex-none"
                >
                  Download
                </button>
              </div>
            </div>
            <div className="-mx-4 h-9 bg-[#FA0F00]" aria-hidden="true" />
          </div>

          {/* Premium Word Card */}
          <div className="relative overflow-hidden rounded-xl border-2 border-[#185ABD] bg-gradient-to-br from-blue-50 to-white px-4 pt-4">
            <div className="flex flex-col items-center justify-between gap-4 pb-4 sm:flex-row">
              <div className="flex items-center gap-4">
                <WordIcon className="h-12 w-12 shrink-0" />
                <div>
                  <div className="font-semibold text-blue-900">Microsoft Word</div>
                  <div className="text-xs font-medium text-blue-700/80">Fully editable document (.docx)</div>
                </div>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  onClick={() => openDocument('docx', 'download')}
                  className="flex-1 cursor-pointer rounded-lg border border-transparent bg-blue-600 px-8 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow sm:flex-none"
                >
                  Download
                </button>
              </div>
            </div>
            <div className="-mx-4 h-9 bg-[#185ABD]" aria-hidden="true" />
          </div>

          <div className="mt-2 text-center text-xs font-medium text-ink/40">
            {isGuest 
              ? "Guest session: nothing is saved, so download your documents now" 
              : "Saved securely to your project archives"}
          </div>
        </div>
      )}
    </div>
  )
}