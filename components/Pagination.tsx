import Link from 'next/link'

export default function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number
  pageCount: number
  hrefFor: (page: number) => string
}) {
  if (pageCount <= 1) return null
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className="btn btn-secondary">
          Newer
        </Link>
      ) : (
        <span />
      )}
      <span className="note">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className="btn btn-secondary">
          Older
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
