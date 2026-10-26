import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="page">
      <div className="narrow">
        <h1 className="page-title">Page not found</h1>
        <p className="page-sub">It may have moved, or the link may be wrong.</p>
        <p className="form-foot">
          <Link href="/articles">All articles</Link>
        </p>
      </div>
    </div>
  )
}
