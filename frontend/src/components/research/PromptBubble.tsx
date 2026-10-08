/** The user's prompt as sent, right-aligned like a chat message above its brief. */
export default function PromptBubble({ topic }: { topic: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-white">
        {topic}
      </div>
    </div>
  )
}
