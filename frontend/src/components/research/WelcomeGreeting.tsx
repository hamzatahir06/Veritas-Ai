const GREETINGS = [
  'Hello, researcher. What are we digging into today?',
  'Welcome back. Ready to deep dive into something?',
  "Give me a topic — I'll do the digging.",
  "What's on your mind? I'll bring back the sources.",
  'Ready when you are. What should I research?',
]

// Picked once per page load, outside any render, so the component itself stays
// pure — a re-render can never swap the greeting out from under the reader.
const GREETING = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]

type WelcomeGreetingProps = {
  className?: string
}

export default function WelcomeGreeting({
  // Default to black text; easily change text-black to text-brand to test color!
  className = 'font-serif text-xl sm:text-2xl font-medium italic text-black',
}: WelcomeGreetingProps) {
  return <h2 className={className}>{GREETING}</h2>
}