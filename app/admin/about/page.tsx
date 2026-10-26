import type { Metadata } from 'next'
import PortraitField from '@/components/PortraitField'
import RepeatableField, { type RepeatField } from '@/components/RepeatableField'
import { ABOUT_LISTS, aboutContent, cleanList } from '@/lib/about'
import { requireAdmin } from '@/lib/auth'
import { DEFAULT_CONTENT, joinLines } from '@/lib/content'
import { formatDateTime } from '@/lib/format'
import { getSettings } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import type { AccessCode } from '@/lib/types'
import { one, plural } from '@/lib/utils'
import { deleteAccessCode, issueAccessCode, revokeAccessCode, updateAbout } from '../about-actions'
import './about-admin.css'

export const metadata: Metadata = { title: 'About page' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const SERVICE_FIELDS: RepeatField[] = [
  { key: 'title', label: 'What you call it', placeholder: 'For example: Brand strategy', wide: true },
  { key: 'text', label: 'A sentence or two about it', multiline: true },
]

const JOURNEY_FIELDS: RepeatField[] = [
  { key: 'org', label: 'Company', placeholder: 'For example: Flextable' },
  { key: 'role', label: 'Your role', placeholder: 'For example: Brand lead' },
  { key: 'period', label: 'When', placeholder: 'For example: 2021 to 2023' },
  { key: 'logo', label: 'Logo', image: true },
  { key: 'text', label: 'Summary', multiline: true, placeholder: 'What the company does and what you did there, in a sentence or two.' },
  {
    key: 'branches',
    label: 'Branches',
    multiline: true,
    rows: 4,
    placeholder: ['One per line, for example:', 'Launched the brand', 'Grew the community to 10,000'].join(String.fromCharCode(10)),
    hint: 'One per line, up to eight. Each becomes a box branching off the trunk beside this company, like a family tree.',
  },
]

const FIGURE_FIELDS: RepeatField[] = [
  { key: 'value', label: 'Number', placeholder: 'e.g. 11' },
  { key: 'label', label: 'What it counts', placeholder: 'e.g. years in design', wide: true },
]

const STUDY_FIELDS: RepeatField[] = [
  { key: 'title', label: 'Qualification or course', placeholder: 'For example: BSc Mass Communication' },
  { key: 'org', label: 'School or institution' },
  { key: 'period', label: 'When', placeholder: 'For example: 2014 to 2018' },
]

const HOBBY_FIELDS: RepeatField[] = [
  { key: 'title', label: 'Hobby', placeholder: 'For example: Cooking for friends', wide: true },
  { key: 'text', label: 'What you love about it', multiline: true },
]

function codeStatus(code: AccessCode): { label: string; live: boolean } {
  if (code.revoked_at) return { label: 'Turned off', live: false }
  if (code.expires_at && new Date(code.expires_at) <= new Date()) return { label: 'Expired', live: false }
  return { label: code.expires_at ? `Works until ${formatDateTime(code.expires_at)}` : 'Works', live: true }
}

export default async function AdminAbout({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const message = one(sp.message)
  const error = one(sp.error)
  const codeMessage = one(sp.codeMessage)
  const codeError = one(sp.codeError)
  const issued = one(sp.issued)
  const settings = await getSettings()
  const about = aboutContent(settings)

  const supabase = await createClient()
  const [{ data: privateRow, error: privateError }, { data: codeRows }] = await Promise.all([
    supabase.from('about_private').select('personal,hobbies').eq('id', true).maybeSingle(),
    supabase.from('about_access_codes').select('*').order('created_at', { ascending: false }),
  ])
  const personalRow = (privateRow ?? {}) as { personal?: string | null; hobbies?: unknown }
  const codes = (codeRows ?? []) as unknown as AccessCode[]
  const privateReady = !privateError

  return (
    <div className="settings">
      <div className="admin-head">
        <h1>About page</h1>
        <a href="/about" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
          View page
        </a>
      </div>
      <p className="muted" style={{ margin: '0 0 20px' }}>
        There are three parts: What I do, Work life and Personal life. A section appears once it has something in it. Personal life
        is only shown to people with an access code; issue codes at the bottom of this page. In every box, press Enter where you want
        a new line; the page breaks the line in the same place.
      </p>
      {message && (
        <p className="notice success" role="status" style={{ marginBottom: 16 }}>
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      <form action={updateAbout} className="form" style={{ marginTop: 0 }}>
        <h2 className="admin-group">What I do</h2>
        <fieldset>
          <legend>Introduction</legend>
          <div className="field">
            <label htmlFor="about_body">Text</label>
            <textarea
              id="about_body"
              name="about_body"
              className="input"
              rows={10}
              defaultValue={settings.about_body}
              style={{ fontFamily: 'var(--mono)', fontSize: 14 }}
            />
            <p className="hint">
              Markdown. The first paragraph is the large opening line beside your photo; press Enter to break it onto a new line. Leave
              an empty line after it, and everything below appears under “The writing”, where each Enter starts a new paragraph.
            </p>
          </div>
        </fieldset>

        <fieldset>
          <legend>Photo</legend>
          <PortraitField
            defaultUrl={settings.about_photo_url ?? ''}
            fallbackSrc={DEFAULT_CONTENT.portrait.src}
            defaultAlt={settings.about_photo_alt ?? ''}
            urlName="about_photo_url"
            altName="about_photo_alt"
            prefix="about"
            uploadLabel="Upload a photo"
            resetLabel="Use the drawing instead"
            hint="A photo a little taller than it is wide works best. PNG, JPEG or WebP, up to 5 MB. Until you add one, the page uses the drawing from the home page."
          />
        </fieldset>

        <fieldset>
          <legend>Opening</legend>
          <p className="hint">The first thing under “What I do”: a sentence about you, your credential, and a few numbers.</p>
          <div className="field">
            <label htmlFor="about_statement">Statement</label>
            <textarea
              id="about_statement"
              name="about_statement"
              className="input"
              rows={2}
              maxLength={300}
              defaultValue={settings.about_statement ?? ''}
            />
          </div>
          <div className="field">
            <label htmlFor="about_credential">Credential</label>
            <textarea
              id="about_credential"
              name="about_credential"
              className="input"
              rows={2}
              maxLength={160}
              defaultValue={settings.about_credential ?? ''}
              placeholder="e.g. Certified by Coursera × London Business School"
            />
          </div>
          <RepeatableField
            name="about_figures"
            fields={FIGURE_FIELDS}
            initial={cleanList(settings.about_figures, 'about_figures')}
            addLabel="Add a number"
            itemLabel="Number"
            max={ABOUT_LISTS.about_figures.max}
          />
        </fieldset>

        <fieldset>
          <legend>How I can help</legend>
          <p className="hint">The kinds of work you take on. Short names read best.</p>
          <RepeatableField
            name="about_services"
            fields={SERVICE_FIELDS}
            initial={cleanList(settings.about_services, 'about_services')}
            addLabel="Add something you do"
            itemLabel="Item"
            max={ABOUT_LISTS.about_services.max}
          />
        </fieldset>

        <h2 className="admin-group">Work life</h2>
        <fieldset>
          <legend>The journey</legend>
          <p className="hint">
            Each company is a stop on one connected line, in the order listed here. Upload its logo (PNG, SVG or JPEG with a plain or
            clear background, up to 2 MB); without one, the first letter shows.
          </p>
          <RepeatableField
            name="about_experience"
            fields={JOURNEY_FIELDS}
            initial={cleanList(settings.about_experience, 'about_experience')}
            addLabel="Add a company"
            itemLabel="Stop"
            max={ABOUT_LISTS.about_experience.max}
          />
        </fieldset>

        <fieldset>
          <legend>Education and training</legend>
          <RepeatableField
            name="about_education"
            fields={STUDY_FIELDS}
            initial={cleanList(settings.about_education, 'about_education')}
            addLabel="Add a qualification"
            itemLabel="Entry"
            max={ABOUT_LISTS.about_education.max}
          />
        </fieldset>

        <fieldset>
          <legend>Brands and clients</legend>
          <div className="field">
            <label htmlFor="about_clients">Names</label>
            <textarea id="about_clients" name="about_clients" className="input content-lines" rows={5} defaultValue={joinLines(about.clients)} />
            <p className="hint">One per line. They show as a list of names under “Brands I’ve worked with”.</p>
          </div>
        </fieldset>

        <h2 className="admin-group">Personal life</h2>
        {privateReady ? (
          <>
            <fieldset>
              <legend>My personal story</legend>
              <div className="field">
                <label htmlFor="about_personal">Your story</label>
                <textarea
                  id="about_personal"
                  name="about_personal"
                  className="input"
                  rows={8}
                  defaultValue={personalRow.personal ?? ''}
                  style={{ fontFamily: 'var(--mono)', fontSize: 14 }}
                />
                <p className="hint">
                  Markdown. Where you grew up, where you live, family, faith, what a good weekend looks like. Only visitors with an
                  access code see this.
                </p>
              </div>
            </fieldset>

            <fieldset>
              <legend>Hobbies</legend>
              <RepeatableField
                name="about_hobbies"
                fields={HOBBY_FIELDS}
                initial={cleanList(personalRow.hobbies, 'about_hobbies')}
                addLabel="Add a hobby"
                itemLabel="Hobby"
                max={ABOUT_LISTS.about_hobbies.max}
              />
            </fieldset>
          </>
        ) : (
          <p className="notice error">Personal life can’t be loaded right now, so it isn’t part of this save. Reload to try again.</p>
        )}

        <div>
          <button type="submit" className="btn">
            Save About page
          </button>
        </div>
      </form>

      <section id="access-codes" className="codes" aria-labelledby="codes-title">
        <h2 id="codes-title" className="admin-group">
          Access codes
        </h2>
        <p className="muted" style={{ margin: '0 0 16px' }}>
          Give someone a code to let them see Personal life. Each is five letters. Turn one off at any time and anyone using it is
          locked out straight away.
        </p>
        {codeMessage && (
          <p className="notice success" role="status" style={{ marginBottom: 16 }}>
            {codeMessage}
          </p>
        )}
        {issued && (
          <p className="code-issued" aria-label={`New code ${issued.split('').join(' ')}`}>
            {issued}
          </p>
        )}
        {codeError && (
          <p className="notice error" role="alert" style={{ marginBottom: 16 }}>
            {codeError}
          </p>
        )}

        <form action={issueAccessCode} className="form code-form" style={{ marginTop: 0 }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="code-label">Who is it for?</label>
              <input id="code-label" name="label" className="input" maxLength={80} placeholder="For example: Ada, my sister" />
            </div>
            <div className="field">
              <label htmlFor="code-expires">Works for</label>
              <select id="code-expires" name="expires" className="input" defaultValue="">
                <option value="">Until I turn it off</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">A year</option>
              </select>
            </div>
            <div className="field span-2">
              <label htmlFor="code-letters">Code</label>
              <input
                id="code-letters"
                name="code"
                className="input code-input"
                maxLength={5}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Leave empty for a random one"
              />
              <p className="hint">Or choose your own five letters.</p>
            </div>
          </div>
          <div>
            <button type="submit" className="btn">
              Issue code
            </button>
          </div>
        </form>

        {codes.length > 0 ? (
          <div className="table-wrap" style={{ marginTop: 24 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>For</th>
                  <th>Status</th>
                  <th className="num">Used</th>
                  <th>Last used</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => {
                  const status = codeStatus(code)
                  return (
                    <tr key={code.id} className={status.live ? undefined : 'is-off'}>
                      <td className="code-cell">{code.code}</td>
                      <td>{code.label || <span className="muted">Not set</span>}</td>
                      <td>{status.label}</td>
                      <td className="num">{plural(code.use_count, 'time')}</td>
                      <td>{code.last_used_at ? formatDateTime(code.last_used_at) : <span className="muted">Never</span>}</td>
                      <td>
                        <div className="row-actions">
                          {!code.revoked_at && (
                            <form action={revokeAccessCode} className="inline-form">
                              <input type="hidden" name="id" value={code.id} />
                              <button type="submit" className="link-btn">
                                Turn off
                              </button>
                            </form>
                          )}
                          <form action={deleteAccessCode} className="inline-form">
                            <input type="hidden" name="id" value={code.id} />
                            <button type="submit" className="link-btn danger">
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint" style={{ marginTop: 16 }}>
            No codes yet. Until you issue one, nobody but you can see Personal life.
          </p>
        )}
      </section>
    </div>
  )
}
