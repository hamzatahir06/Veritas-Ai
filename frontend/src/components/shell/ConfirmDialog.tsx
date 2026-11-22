import { useEffect, useRef, type ReactNode } from 'react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  /** Defaults to "Stay here". */
  cancelLabel?: string
  /** Keeps the confirm button disabled, e.g. until a typed confirmation matches. */
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal yes/no prompt on the native <dialog>: showModal() gives the backdrop, focus trap,
 * Escape-to-cancel and an inert page behind it for free. Focus starts on the first focusable
 * element: Cancel (the safe choice), or a field passed in `children`.
 */
export default function ConfirmDialog({
  open, title, children, confirmLabel, cancelLabel = 'Stay here', confirmDisabled = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); onCancel() }}  // Escape: let the parent own `open`
      onClick={(e) => e.target === e.currentTarget && onCancel()}  // click on the backdrop
      aria-labelledby="confirm-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md animate-pop-in rounded-2xl border border-black/20 bg-white p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-black">{title}</h2>
        <div className="text-sm leading-relaxed text-ink/85">{children}</div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-lg border border-black/20 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-black/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
