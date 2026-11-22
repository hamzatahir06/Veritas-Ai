import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import BriefAnatomy from './BriefAnatomy'
import Faq from './Faq'
import FinalCta from './FinalCta'
import LiveDemo from './LiveDemo'
import Sources from './Sources'
import TimeSaved from './TimeSaved'
import TrustedFields from './TrustedFields'
import UseCases from './UseCases'
import Footer from '../shell/Footer'

const column = 'mx-auto w-full max-w-5xl px-4 sm:px-6'

/**
 * Everything below the signed-out hero. Home lazy-loads it as one chunk, so
 * signed-in users never download it and visitors see the hero first.
 */
export default function LandingSections({ onSelect, onStart }: {
  /** Runs an example topic (the use-case cards). */
  onSelect: (topic: string) => void
  /** The closing CTA: back to the prompt box. */
  onStart: () => void
}) {
  // The TopBar's in-page links (e.g. /#sources) target sections in this chunk,
  // so the scroll runs here, once the section actually exists.
  // Keyed on the whole location so clicking the link again re-scrolls.
  const location = useLocation()
  useEffect(() => {
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location])

  return (
    <>
      {/* Order: how it works → sources → who it's for (the fields band, outside the centred column so it
          runs edge to edge) → the rest. */}
      <div className={`${column} flex flex-col gap-20 pt-16 pb-20 sm:gap-24 sm:pb-24`}>
        <LiveDemo />
        <Sources />
      </div>
      <TrustedFields />
      <div className={`${column} flex flex-col gap-20 pt-20 pb-16 sm:gap-24 sm:pt-24`}>
        <UseCases onSelect={onSelect} />
        <TimeSaved />
        <BriefAnatomy />
        <Faq />
        <FinalCta onStart={onStart} />
      </div>
      <Footer />
    </>
  )
}
