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

export default function WelcomeGreeting({ className }: { className: string }) {
  return <h2 className={className}>{GREETING}</h2>
}
