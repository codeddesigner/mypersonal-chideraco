export default function SearchForm({
  action,
  q,
  hidden = {},
  autoFocus = false,
}: {
  action: string
  q?: string
  hidden?: Record<string, string | undefined>
  autoFocus?: boolean
}) {
  return (
    <form role="search" action={action} method="get" className="search-form">
      <label htmlFor="search-q" className="sr-only">
        Search articles
      </label>
      <input
        id="search-q"
        name="q"
        type="search"
        className="input"
        defaultValue={q}
        placeholder="Search articles"
        autoFocus={autoFocus}
        maxLength={100}
      />
      {Object.entries(hidden).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <button type="submit" className="btn btn-secondary">
        Search
      </button>
    </form>
  )
}
