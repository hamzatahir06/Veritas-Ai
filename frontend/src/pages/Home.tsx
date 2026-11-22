import { lazy, Suspense, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import HeroBanner from '../components/landing/HeroBanner'
import PromptBox from '../components/research/PromptBox'
import PromptBubble from '../components/research/PromptBubble'
import WelcomeGreeting from '../components/research/WelcomeGreeting'
import SuggestedTopics from '../components/research/SuggestedTopics'
import StreamingProgress from '../components/research/StreamingProgress'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { usePageContext } from '../hooks/usePageContext'

// The markdown renderer is the heaviest part of the bundle and only needed
// once a brief arrives, so a landing visitor never downloads it.
const ResultView = lazy(() => import('../components/research/ResultView'))
// Below the signed-out hero; signed-in users never download it.
const LandingSections = lazy(() => import('../components/landing/LandingSections'))

export default function Home() {
  const { isSignedIn, accessToken, thread } = usePageContext()
  const { turns, ask, stop, isStreaming } = thread
  useDocumentTitle()
  const askTopic = (topic: string) => ask(topic, accessToken)
  const hasStarted = turns.length > 0
  const location = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)

  // The "Home" link (plain /) returns the view to the top; in-page links (e.g. /#sources)
  // are scrolled to by LandingSections, which holds those sections.
  useEffect(() => {
    if (!location.hash) scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location])

  // Closing CTA: glide back up to the prompt box and put the cursor in it.
  const backToPrompt = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    document.getElementById('research-topic')?.focus({ preventScroll: true })
  }

  // A new turn scrolls its top (not the page bottom) into view.
  const lastTurnRef = useRef<HTMLDivElement>(null)
  const lastTurnCountRef = useRef(0)
  useEffect(() => {
    if (turns.length > lastTurnCountRef.current) {
      setTimeout(() => lastTurnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
    lastTurnCountRef.current = turns.length
  }, [turns.length])

  // Empty state: hero (or greeting), prompt and, signed out, the landing sections.
  if (!hasStarted) {
    return (
      // `relative isolate`: the backdrop's -z-10 stays above the shell's background but under the content.
      <div ref={scrollRef} className="relative isolate flex h-full flex-col overflow-y-auto">
        {/* Signed in it fills the (otherwise empty) screen; signed out it fades out below the hero. */}
        <div
          aria-hidden="true"
          className={`home-backdrop pointer-events-none absolute inset-x-0 top-0 -z-10 ${isSignedIn ? 'h-full' : 'h-176'}`}
        />
        {/* Greeting/hero + prompt + topics fill exactly one screen, optically centred; signed out,
            the landing sections start below the fold. */}
        <div
          className={`mx-auto flex min-h-full w-full shrink-0 flex-col items-center justify-center px-4 py-6 sm:px-6 ${
            isSignedIn ? 'max-w-4xl gap-5 pb-[12vh]' : 'max-w-5xl gap-5'
          }`}
        >
          {isSignedIn ? (
            <WelcomeGreeting className="text-center font-serif text-2xl font-medium italic text-balance text-black sm:text-3xl" />
          ) : (
            <HeroBanner />
          )}

          <div className="w-full">
            <PromptBox onSubmit={askTopic} onStop={stop} streaming={isStreaming} showExamples />
          </div>

          <SuggestedTopics onSelect={askTopic} />
        </div>

        {/* Promotional content for signed-out visitors. */}
        {!isSignedIn && (
          <Suspense fallback={null}>
            <LandingSections onSelect={askTopic} onStart={backToPrompt} />
          </Suspense>
        )}
      </div>
    )
  }

  // Chat view: the turns, with the prompt bar pinned to the bottom.
  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {/* Gutter at every width: with the sidebar open, main is narrower than max-w-4xl
              on tablets/small laptops, so dropping it at md made the turns touch the edges. */}
          <div className="mx-auto mt-4 flex max-w-4xl flex-col gap-6 px-4 pb-6 sm:px-6">
            {turns.map((turn, index) => {
              const isLast = index === turns.length - 1
              return (
                <div
                  key={turn.id}
                  ref={isLast ? lastTurnRef : null}
                  className="flex animate-fade-up scroll-mt-6 flex-col gap-4"
                >
                  <PromptBubble topic={turn.topic} />

                  {/* The trail outlives the run: it stays (collapsed) once the
                      brief renders, so the sources behind each search are
                      reopenable without scrolling to the bottom of the result. */}
                  {(turn.status === 'streaming' || (turn.status === 'done' && turn.progress.length > 0)) && (
                    <StreamingProgress events={turn.progress} done={turn.status === 'done'} />
                  )}
                  {turn.status === 'stopped' && (
                    <div className="animate-fade-up rounded-2xl border border-black/20 bg-black/5 p-4 text-sm text-ink/80">
                      Research stopped — nothing was saved.
                    </div>
                  )}
                  {turn.status === 'error' && (
                    <div role="alert" className="flex animate-fade-up flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <span className="min-w-0 wrap-break-word">{turn.errorMessage}</span>
                      {/* Retry only on the latest turn, and never while another run is going. */}
                      {isLast && !isStreaming && (
                        <button
                          type="button"
                          onClick={() => askTopic(turn.topic)}
                          className="shrink-0 cursor-pointer rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                        >
                          Try again
                        </button>
                      )}
                    </div>
                  )}
                  {turn.status === 'chat' && turn.chatReply && (
                    <div className="max-w-[85%] animate-fade-up rounded-2xl rounded-tl-sm border border-black/10 bg-white px-4 py-2.5 whitespace-pre-line wrap-break-word text-ink shadow-xs sm:max-w-[75%]">
                      {turn.chatReply}
                    </div>
                  )}
                  {turn.status === 'done' && turn.saveError && (
                    <div role="status" className="animate-fade-up rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      This brief couldn't be saved to your projects — download it below to keep it.
                    </div>
                  )}
                  {turn.status === 'done' && turn.result && (
                    <Suspense fallback={null}>
                      <ResultView result={turn.result} accessToken={accessToken} />
                    </Suspense>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* pb: keeps the box's border clear of main's clipped edge and of the phone's home indicator. */}
      <div className="shrink-0 border-t border-black/10 bg-white pt-2 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <PromptBox onSubmit={askTopic} onStop={stop} streaming={isStreaming} />
        </div>
      </div>
    </div>
  )
}
