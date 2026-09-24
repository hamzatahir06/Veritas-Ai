import { useState, useRef, useEffect } from 'react'

type PromptBoxProps = {
  onSubmit: (topic: string) => void
  onStop?: () => void
  /** A research run is in progress: input is locked and the button becomes "Stop Research". */
  streaming?: boolean
}

export default function PromptBox({ onSubmit, onStop, streaming }: PromptBoxProps) {
  const [topic, setTopic] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount and whenever research finishes (streaming goes true → false)
  useEffect(() => {
    if (!streaming) {
      inputRef.current?.focus()
    }
  }, [streaming])

  const handleSubmit = () => {
    if (!topic.trim() || streaming) return
    onSubmit(topic)
    setTopic('')

    // Retain focus right after submit
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-brand/40 bg-white py-2.5 pr-2.5 pl-4 sm:px-4 sm:py-3 shadow-sm transition-colors focus-within:border-brand">
      <input
        ref={inputRef}
        autoFocus
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            handleSubmit()
          }
        }}
        placeholder="What would you like to research?"
        disabled={streaming}
        className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink/40 disabled:opacity-50 caret-brand"
      />
      {streaming ? (
        <button
          type="button"
          onClick={onStop}
          className="ui-chrome shrink-0 cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 active:scale-95"
        >
          <span className="sm:hidden">Stop</span>
          <span className="hidden sm:inline">Stop Research</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          aria-label="Start Research"
          className="ui-chrome flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-brand px-3 py-2.5 sm:px-4 sm:py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {/* Solid paper plane (Font Awesome Free, CC BY 4.0) — matches the "Final'e UI" mockup */}
          <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" className="h-4 w-4 shrink-0">
            <path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z" />
          </svg>
          <span className="hidden sm:inline">Start Research</span>
        </button>
      )}
    </div>
  )
}
