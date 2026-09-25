import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import HeroBanner from '../components/landing/HeroBanner'
import LandingPromos from '../components/landing/LandingPromos'
import PromptBox from '../components/research/PromptBox'
import WelcomeGreeting from '../components/research/WelcomeGreeting'
import SuggestedTopics from '../components/research/SuggestedTopics'
import StreamingProgress from '../components/research/StreamingProgress'
import ResultView from '../components/research/ResultView'
import Footer from '../components/shell/Footer'
import { usePageContext } from '../hooks/usePageContext'
import { useResearchThread } from '../hooks/useResearchThread'

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
      <div ref={scrollRef} className="flex h-full flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-5 px-4 py-6">
          {/* Top Hero: Brain Box for logged-out users */}
          {!isSignedIn ? (
            <HeroBanner />
          ) : (
            <WelcomeGreeting className="font-serif text-2xl font-medium italic text-black" />
          )}

          {/* Type Bar */}
          <div className="w-full">
            <PromptBox onSubmit={askTopic} onStop={stop} streaming={isStreaming} />
          </div>

          <SuggestedTopics onSelect={askTopic} />

          {/* Promotional Content (Shown for unauthenticated users on scroll) */}
          {!isSignedIn && <LandingPromos />}
        </div>
        {!isSignedIn && <Footer />}
      </div>
    )
  }

  // --- ACTIVE CHAT VIEW ---
  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-6 mt-4 md:px-0">
            {turns.map((turn, index) => {
              const isLast = index === turns.length - 1
              return (
                <div
                  key={turn.id}
                  ref={isLast ? lastTurnRef : null}
                  className="flex flex-col gap-4 scroll-mt-6"
                >
                  <div className="flex justify-end">
                    <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-white">
                      {turn.topic}
                    </div>
                  </div>

                  {/* The trail outlives the run: it stays (collapsed) once the
                      brief renders, so the sources behind each search are
                      reopenable without scrolling to the bottom of the result. */}
                  {(turn.status === 'streaming' || turn.status === 'done') &&
                    turn.progress.length > 0 && (
                      <StreamingProgress
                        events={turn.progress}
                        done={turn.status === 'done'}
                      />
                    )}
                  {turn.status === 'stopped' && (
                    <div className="rounded-2xl border border-black/10 bg-black/5 p-4 text-sm text-ink/60">
                      Research stopped — nothing was saved.
                    </div>
                  )}
                  {turn.status === 'error' && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {turn.errorMessage}
                    </div>
                  )}
                  {turn.status === 'chat' && turn.chatReply && (
                    <div className="max-w-[75%] rounded-2xl rounded-tl-sm border border-black/10 bg-white px-4 py-2.5 text-ink">
                      {turn.chatReply}
                    </div>
                  )}
                  {turn.status === 'done' && turn.result && <ResultView result={turn.result} accessToken={accessToken} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-black/5 bg-white pt-2 pb-0 sm:pb-1">
        <div className="mx-auto max-w-4xl px-4 md:px-0">
          <PromptBox onSubmit={askTopic} onStop={stop} streaming={isStreaming} />
        </div>
      </div>
    </div>
  )
}
