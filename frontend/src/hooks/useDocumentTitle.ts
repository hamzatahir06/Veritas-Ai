import { useEffect } from 'react'

const APP_NAME = 'Veritas AI'

/** The browser tab's title while the calling page is mounted: "<title> · Veritas AI", or just the app name. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
