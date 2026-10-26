# chidera.co

An editorial personal publication for Chidera Nwanyemike.
Next.js 15 (App Router, TypeScript) · Supabase (Postgres, Auth, Storage) · plain CSS · deployed on Vercel.

## Pages

| Page | Route |
|---|---|
| Home: featured article, topics, latest writing (4-column grid) | `/` |
| All articles: search, topic filter, newest/oldest, pagination | `/articles` |
| Topics index and topic listings | `/topics`, `/topics/[slug]` |
| Search | `/search` |
| Article: public preview, gated full text, previous/next, related | `/articles/[slug]` |
| About | `/about` |
| Sign in, create account, password reset | `/login`, `/signup`, `/forgot-password`, `/reset-password` |
| Reader account | `/account` |
| Subscription | `/subscribe` |
| Admin: overview, articles + editor + preview, topics, readers, settings | `/admin` |

## How access works

Article metadata and the public **preview** live in `articles`. The full text lives in
`article_bodies`, and row-level security on that table calls `private.can_read_article()`, so the
database itself decides who receives the body:

| Article access | Signed out | Registered reader | Subscriber | Admin |
|---|---|---|---|---|
| Registered readers (default) | preview | full | full | full |
| Subscribers only | preview | full while *Require a subscription* is off; preview + subscribe prompt when on | full | full |
| Everyone | full | full | full | full |

Suspended accounts get previews only. Drafts, archived and scheduled articles are invisible to
everyone but admins. Protected text is never rendered into the page for a reader without access and
is not available from the public API. Search matches words inside bodies but returns only article ids.

Accounts and subscriptions are separate tables: creating an account never implies a subscription.

## Admin

Admins are listed in `private.admin_emails`; an account created with one of those emails becomes an
admin (after its email is confirmed). To add another admin:

```sql
insert into private.admin_emails (email) values ('someone@example.com');
update public.profiles set role = 'admin' where email = 'someone@example.com'; -- if they already signed up
```

Roles can't be changed from the UI.

**Publishing:** Admin → Articles → New article. Markdown editor with image upload (Supabase Storage,
`article-images` bucket), URL slug, short description, public preview (defaults to the first two
paragraphs), topics, reading access, publication date (a future date schedules it), and
*Feature on the homepage* (featuring one article un-features the previous one). *Save & preview*
shows the article exactly as readers will see it.

## Subscriptions

Admin → Settings holds the plan name, price, currency, billing interval, provider and a checkout
link (a Paystack/Stripe/Flutterwave hosted payment page). Turn on *Require a subscription* when
you're ready to charge; until then every registered reader can read every article.

After a reader pays, activate them under Admin → Readers → *Grant subscription* (one billing period
from today). A provider webhook can later write to the same `subscriptions` table automatically.

## Analytics

A small first-party event log (`public.events`, no cookies, no third parties): article views,
read-more clicks, sign-ups started, accounts created, sign-ins, subscriptions started/completed,
searches and topic selections. Totals and the most-read articles appear on the admin overview.

## Live setup

- Site: https://chidera.co (the `*.vercel.app` addresses redirect there; Vercel project `chidera-com`, functions in London `lhr1`)
- Database: Supabase project `chidera-com` (eu-west-2)
- First admin: the email listed in `private.admin_emails` (set it in `supabase/seed.sql` before seeding a new database)

## Setup from scratch

1. **Database:** apply `supabase/migrations/*.sql` in order, then optionally `supabase/seed.sql`
   (topics and placeholder essays). With the Supabase CLI: `supabase db push`.
2. **Environment** (`.env.local` locally, project settings on Vercel):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - `NEXT_PUBLIC_SITE_URL` (optional; defaults to the Vercel production domain)
3. **Supabase → Authentication → URL Configuration:**
   - Site URL: your domain, e.g. `https://chidera.co`
   - Redirect URLs: `https://chidera.co/**` (and any `*.vercel.app` URL you use)
4. **Supabase → Authentication → Emails → SMTP:** add an email provider (Resend, Postmark, etc.).
   Supabase's built-in mailer only delivers to your own team's addresses and is heavily rate-limited,
   so readers won't receive confirmation emails without it. Alternatively, turn off
   *Confirm email* under Authentication → Sign In / Providers → Email, and readers are signed in
   immediately after creating an account.
5. `npm install && npm run dev`

## Structure

```
app/            routes (public pages, auth route handlers, admin)
components/     Navbar, FeaturedArticle, ArticleGrid/Item, ArticleMeta, TopicList, SearchForm,
                Pagination, AuthPrompt, ArticleView, Prose, Footer, ArticleEditor, AdminNav
lib/            Supabase clients, queries, auth helpers, markdown, formatting
supabase/       migrations and seed data
```

## Design

- Type: Chidera SPAR (headings, your own typeface), Geist (reading and interface, SF Pro as fallback),
  Newsreader italic (accents), Courier Prime (notes). Loaded with `next/font`.
- The heading font is stored in `fonts-src/` as eight parts and rebuilt into `app/fonts/ChideraSpar-Regular.woff`
  by `scripts/join-font.mjs` before every build. To replace it, put a new `.woff` at that path and delete `fonts-src/`.
- Each article has a colour (`articles.accent`: pool, leaf, lemon, blush, iris, saffron) used for its header panel, card and artwork.
  Left empty, a colour is picked from the URL.
- Covers: upload a photo in the editor (*Cover* panel). Without one, `lib/cover.ts` draws geometric artwork from the URL and colour.
- Tokens (colours, type, spacing) are at the top of `app/globals.css`.
