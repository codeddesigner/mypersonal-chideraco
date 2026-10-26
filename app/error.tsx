'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <div className="narrow">
        <h1 className="page-title">Something went wrong</h1>
        <p className="page-sub">This page couldn’t be loaded.</p>
        <p className="form-foot">
          <button type="button" className="btn btn-secondary" onClick={reset}>
            Try again
          </button>
        </p>
      </div>
    </div>
  )
}
