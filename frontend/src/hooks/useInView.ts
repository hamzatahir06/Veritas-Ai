import { useEffect, useRef, useState } from 'react'

/**
 * Turns true once, the first time the element's top passes the lower fifth of the
 * viewport (count-ups, autoplay). Not a visibility ratio: an element taller than the
 * screen (a phone) could never reach one, and would stay unplayed forever.
 */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -20% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  return [ref, inView] as const
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
