/** The user's prompt as sent, right-aligned like a chat message above its brief. */
export default function PromptBubble({ topic }: { topic: string }) {
  return (
    <div className="flex justify-end">
      {/* wrap-break-word: a pasted URL or long token would otherwise overflow the bubble. */}
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 wrap-break-word text-white shadow-xs sm:max-w-[75%]">
        {topic}
      </div>
    </div>
  )
}
