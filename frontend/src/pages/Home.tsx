import { lazy, Suspense, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import HeroBanner from '../components/landing/HeroBanner'
import LandingPromos from '../components/landing/LandingPromos'
import TrustedFields from '../components/landing/TrustedFields'
import PromptBox from '../components/research/PromptBox'
import PromptBubble from '../components/research/PromptBubble'
import WelcomeGreeting from '../components/research/WelcomeGreeting'
import SuggestedTopics from '../components/research/SuggestedTopics'
import StreamingProgress from '../components/research/StreamingProgress'
import Footer from '../components/shell/Footer'
import { usePageContext } from '../hooks/usePageContext'
import { useResearchThread } from '../hooks/useResearchThread'

// The markdown renderer is the heaviest part of the bundle and only needed
// once a brief arrives, so a landing visitor never downloads it.
const ResultView = lazy(() => import('../components/research/ResultView'))

export default function Home() {
  const { isSignedIn, accessToken } = usePageContext()
  const { turns, ask, stop, isStreaming } = useResearchThread()
  const askTopic = (topic: string) => ask(topic, accessToken)
  const hasStarted = turns.length > 0
  const location = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)

  // "Sources" link (/#sources) scrolls to that section; "Home" link (plain /)
  // returns the view to the top.
  useEffect(() => {
    setTimeout(() => {
      if (location.hash === '#sources') {
        document.getElementById('sources')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 50)
  }, [location])

  const lastTurnRef = useRef<HTMLDivElement>(null)
  const lastTurnCountRef = useRef(0)

  useEffect(() => {
    const newTurnAdded = turns.length > lastTurnCountRef.current

    if (newTurnAdded) {
      setTimeout(() => {
        lastTurnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }

    lastTurnCountRef.current = turns.length
  }, [turns.length])

  // --- INITIAL VIEW (Empty State) ---
  if (!hasStarted) {
    return (
      // `relative isolate`: the backdrop's -z-10 stays above the shell's background but under the content.
      <div ref={scrollRef} className="relative isolate flex h-full flex-col overflow-y-auto">
        {/* Signed in it fills the (otherwise empty) screen; signed out it fades out before the fields band. */}
        <div
          aria-hidden="true"
          className={`home-backdrop pointer-events-none absolute inset-x-0 top-0 -z-10 ${isSignedIn ? 'h-full' : 'h-176'}`}
        />
        {/* Signed in there is nothing below, so greeting + prompt sit optically centred. */}
        <div
          className={`mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-5 px-4 py-6 sm:px-6 ${
            isSignedIn ? 'justify-center pb-[12vh]' : ''
          }`}
        >
          {/* Top Hero: Brain Box for logged-out users */}
          {!isSignedIn ? (
            <HeroBanner />
          ) : (
            <WelcomeGreeting className="text-center font-serif text-2xl font-medium italic text-balance text-black sm:text-3xl" />
          )}

          {/* Type Bar */}
          <div className="w-full">
            <PromptBox onSubmit={askTopic} onStop={stop} streaming={isStreaming} />
          </div>

          <SuggestedTopics onSelect={askTopic} />
        </div>

        {/* Promotional content for signed-out visitors. The fields band sits
            outside the centred column so it runs edge to edge. */}
        {!isSignedIn && (
          <>
            <TrustedFields />
            <div className="mx-auto w-full max-w-4xl px-4">
              <LandingPromos />
            </div>
            <Footer />
          </>
        )}
      </div>
    )
  }

  // --- ACTIVE CHAT VIEW ---
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
                      <StreamingProgress
                        events={turn.progress}
                        done={turn.status === 'done'}
                      />
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
