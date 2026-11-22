import { Link } from 'react-router-dom'
import PageMessage from '../components/shell/PageMessage'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <PageMessage>
      This page doesn't exist —{' '}
      <Link to="/" className="font-medium text-brand-dark underline decoration-brand/40 hover:decoration-brand">
        go to Home
      </Link>
      .
    </PageMessage>
  )
}
