import Image from 'next/image'
import { branchesOf, monogram, stopAccent, type Role } from '@/lib/about'

// Logos uploaded in the admin live in Supabase storage, which the site can shrink to the size shown.
// A logo can be a huge file, so it's resized rather than sent to the browser as uploaded.
function resizable(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.host.endsWith('.supabase.co') && u.pathname.startsWith('/storage/v1/object/public/')
  } catch {
    return false
  }
}

// The work journey, drawn like a family tree: one trunk runs through every company in order,
// and the things done at each company branch off it. On phones the trunk runs down the left.
// Logos come from Admin → About page; until one is added, a monogram shows.
export default function Journey({ roles }: { roles: Role[] }) {
  return (
    <ol className="journey">
      {roles.map((item, index) => {
        const name = item.org || item.role
        const branches = branchesOf(item)
        return (
          <li key={`${name}-${index}`} className={branches.length > 0 ? 'stop has-branches' : 'stop'} data-accent={stopAccent(index)}>
            <div className={item.logo ? 'stop-mark' : 'stop-mark is-monogram'} aria-hidden="true">
              {item.logo ? (
                <Image src={item.logo} alt="" fill sizes="68px" unoptimized={!resizable(item.logo)} />
              ) : (
                <span>{monogram(name)}</span>
              )}
            </div>
            <div className="stop-body">
              <div className="stop-head">
                <h3 className="stop-org">{name}</h3>
                {item.org && item.role && <p className="stop-role">{item.role}</p>}
                {item.period && <p className="stop-period">{item.period}</p>}
                {item.text && <p className="stop-text">{item.text}</p>}
              </div>
              {branches.length > 0 && (
                <ul className="branches">
                  {branches.map((branch, i) => (
                    <li key={i}>
                      <span>{branch}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
