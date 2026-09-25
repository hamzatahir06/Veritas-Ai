import { useMemo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import type { StreamEvent } from '../../lib/api'
import { PdfIcon, WordIcon } from './DocumentIcons'
import { API_BASE } from '../../lib/api'

type DoneEvent = Extract<StreamEvent, { type: 'done' }>
type Source = DoneEvent['sources'][number]

/**
 * html2pdf is pulled from a CDN at runtime (guest-side export only), so it has
 * no import to type against — this is the slice of its API we actually call.
 */
type Html2Pdf = {
  set(options: object): Html2Pdf
  from(element: HTMLElement): Html2Pdf
  save(): void
}

declare global {
  interface Window {
    html2pdf?: () => Html2Pdf
  }
}

type ResultViewProps = {
  result: DoneEvent
  accessToken?: string
}

// Helper: Convert basic markdown constructs to formatted HTML for documents
function markdownToFormattedHtml(md: string): string {
  if (!md) return ''
  return md
    .replace(/^### (.*$)/gim, '<h3 style="font-size:13pt; color:#334155; margin-top:14px; margin-bottom:6px;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="font-size:16pt; color:#1e293b; margin-top:20px; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="font-size:20pt; color:#0f172a; margin-bottom:12px;">$1</h1>')
    .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\* (.*$)/gim, '<li style="margin-bottom:4px;">$1</li>')
    .replace(/^- (.*$)/gim, '<li style="margin-bottom:4px;">$1</li>')
    .replace(/\n\n/gim, '</p><p style="margin-bottom:10px; font-size:11pt; line-height:1.6;">')
    .replace(/\n/gim, '<br/>')
}

const CITE_HREF = '#cite-'

/**
 * Mark IEEE citations like "[3]" as links; the `a` renderer below points each
 * one at its source's URL. Only numbers that have an entry are linked, and an existing markdown
 * link or reference definition ("[3](…)", "[3]:") is left alone.
 */
function linkCitations(md: string, sourceCount: number): string {
  // 【n】 is accepted too: briefs saved before the backend normalised it.
  return md.replace(/(?:\[(\d+)\]|【\s*(\d+)\s*】)(?![(:])/g, (match, bracket?: string, lenticular?: string) => {
    const n = (bracket ?? lenticular) as string
    const index = Number(n)
    return index >= 1 && index <= sourceCount ? `[\\[${n}\\]](${CITE_HREF}${n})` : match
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

  // --- Authenticated Server-Side Export ---
  const handleServerAction = async (format: 'docx' | 'pdf', action: 'download' | 'view' = 'download') => {
    if (!result.project_id || !accessToken) return
    
    let viewerTab: Window | null = null
    if (action === 'view') {
      viewerTab = window.open('', '_blank')
      if (viewerTab) {
        viewerTab.document.title = "Loading PDF..."
        viewerTab.document.body.innerHTML = `
          <div style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; color:#666;">
            Decrypting and loading document...
          </div>
        `
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/projects/${result.project_id}/download/${format}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: 'follow',
      })
      
      if (!res.ok) throw new Error("Failed to fetch document")
      
      const blob = await res.blob()
      
      if (action === 'view' && viewerTab) {
        const pdfBlob = new Blob([blob], { type: 'application/pdf' })
        const blobUrl = URL.createObjectURL(pdfBlob)
        viewerTab.location.href = blobUrl
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000) 
      } else {
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        const safeTopic = (result.topic || 'research-brief').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40)
        a.download = `${safeTopic}.${format}`
        a.click()
        URL.revokeObjectURL(blobUrl)
        if (viewerTab) viewerTab.close() 
      }
    } catch (err) {
      console.error(err)
      if (viewerTab) {
        viewerTab.document.body.innerHTML = `
          <div style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; color:red;">
            Failed to load document securely.
          </div>
        `
      }
    }
  }

  // --- Guest Action 1: View PDF in New Tab ---
  const handleGuestPdfView = () => {
    const safeTopic = result.topic || 'Research Brief'
    const htmlBody = markdownToFormattedHtml(result.markdown || '')
    const sourcesList = uniqueSources.map((s) => 
      `<li style="margin-bottom:6px;"><a href="${s.url}" target="_blank" style="color:#2563eb; text-decoration:underline;">${s.title || s.url}</a></li>`
    ).join('')
    
    const sourcesHtml = uniqueSources.length > 0 ? `
      <div style="margin-top:30px; border-top:1px solid #e2e8f0; padding-top:20px;">
        <h3 style="font-size:14pt; color:#0f172a; margin-bottom:12px;">Sources & Citations</h3>
        <ol style="padding-left:20px;">${sourcesList}</ol>
      </div>
    ` : ''

    const viewTab = window.open('', '_blank')
    if (!viewTab) return

    viewTab.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${safeTopic} - Veritas AI PDF View</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #0f172a;
            max-width: 850px;
            margin: 0 auto;
            padding: 40px 20px;
            background-color: #f8fafc;
          }
          .container {
            background: #ffffff;
            padding: 40px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #0f172a; }
          .top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e2e8f0;
          }
          .btn {
            background: #dc2626;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
          }
          .btn:hover { background: #b91c1c; }
          @media print {
            .top-bar { display: none !important; }
            body { background: white; padding: 0; }
            .container { border: none; box-shadow: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="top-bar">
          <span style="font-weight:700; font-size:16px;">Veritas AI Document Viewer</span>
          <button class="btn" onclick="window.print()">Print / Save as PDF</button>
        </div>
        <div class="container">
          <h1>${safeTopic}</h1>
          <hr style="border:none; border-top:2px solid #0f172a; margin: 16px 0 24px 0;"/>
          <div><p style="margin-bottom:10px; font-size:11pt; line-height:1.6;">${htmlBody}</p></div>
          ${sourcesHtml}
        </div>
      </body>
      </html>
    `)
    viewTab.document.close()
  }

  // --- Guest Action 2: Direct Local PDF Download ---
  const handleGuestPdfDownload = async () => {
    const safeTopic = (result.topic || 'research-brief').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40)
    
    // Inject html2pdf dynamically if not present
    if (!window.html2pdf) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load PDF library'))
        document.head.appendChild(script)
      })
    }

    const htmlBody = markdownToFormattedHtml(result.markdown || '')
    const sourcesList = uniqueSources.map((s) => 
      `<li style="margin-bottom:6px;"><a href="${s.url}">${s.title || s.url}</a></li>`
    ).join('')
    
    const sourcesHtml = uniqueSources.length > 0 ? `
      <div style="margin-top:30px; border-top:1px solid #e2e8f0; padding-top:20px;">
        <h3 style="font-size:14pt; color:#0f172a; margin-bottom:12px;">Sources & Citations</h3>
        <ol style="padding-left:20px;">${sourcesList}</ol>
      </div>
    ` : ''

    const container = document.createElement('div')
    container.style.padding = '30px'
    container.style.fontFamily = 'Helvetica, Arial, sans-serif'
    container.style.color = '#0f172a'
    container.innerHTML = `
      <h1 style="font-size: 22px; font-weight: bold; margin-bottom: 12px; color: #0f172a;">${result.topic || 'Research Brief'}</h1>
      <hr style="border:none; border-top:2px solid #0f172a; margin-bottom: 20px;"/>
      <div style="font-size: 13px; line-height: 1.6;"><p style="margin-bottom:10px;">${htmlBody}</p></div>
      ${sourcesHtml}
    `

    const opt = {
      margin: [12, 12, 12, 12],
      filename: `${safeTopic}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }

    const html2pdf = window.html2pdf
    if (!html2pdf) throw new Error('PDF library failed to load.')
    html2pdf().set(opt).from(container).save()
  }

  // --- Guest Action 3: Microsoft Word Export (.doc) ---
  const handleGuestWordDownload = () => {
    const safeTopic = (result.topic || 'research-brief').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40)
    const htmlBody = markdownToFormattedHtml(result.markdown || '')
    const sourcesList = uniqueSources.map((s) => 
      `<li><a href="${s.url}">${s.title || s.url}</a></li>`
    ).join('')
    
    const sourcesHtml = uniqueSources.length > 0 ? `
      <br/><hr/><br/>
      <h3>Sources & Citations</h3>
      <ol>${sourcesList}</ol>
    ` : ''

    // Modern MS Word HTML container with Word XML Schemas
    const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${result.topic || 'Research Brief'}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Normal</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          body {
            font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #1e293b;
            margin: 1in;
          }
          h1 { font-size: 20pt; color: #0f172a; margin-bottom: 10pt; }
          h2 { font-size: 15pt; color: #1e293b; margin-top: 15pt; margin-bottom: 6pt; }
          h3 { font-size: 12pt; color: #334155; margin-top: 12pt; }
          p { margin-bottom: 8pt; }
          ul, ol { margin-bottom: 8pt; }
          a { color: #2563eb; text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>${result.topic || 'Research Brief'}</h1>
        <hr style="border:none; border-top:2px solid #0f172a;"/>
        <br/>
        <div><p>${htmlBody}</p></div>
        ${sourcesHtml}
      </body>
      </html>
    `

    // '\ufeff' (UTF-8 Byte Order Mark) prevents MS Word from throwing file corruption warnings
    const blob = new Blob(['\ufeff', wordHtml], { 
      type: 'application/msword;charset=utf-8' 
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeTopic}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const isGuest = !result.project_id || !accessToken

  const onPdfClick = (action: 'download' | 'view') => {
    if (isGuest) {
      if (action === 'view') handleGuestPdfView()
      else handleGuestPdfDownload()
    } else {
      handleServerAction('pdf', action)
    }
  }

  const onWordClick = () => {
    if (isGuest) {
      handleGuestWordDownload()
    } else {
      handleServerAction('docx', 'download')
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
                  onClick={() => onPdfClick('view')}
                  className="flex-1 cursor-pointer rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition-all hover:border-red-400 hover:bg-red-50 sm:flex-none"
                >
                  View
                </button>
                <button
                  onClick={() => onPdfClick('download')}
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
                  onClick={() => onWordClick()}
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
              ? "⚡ Guest Session: Client-side direct document export" 
              : "Saved securely to your project archives"}
          </div>
        </div>
      )}
    </div>
  )
}