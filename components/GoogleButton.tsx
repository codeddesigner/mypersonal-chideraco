// "Continue with Google", followed by a divider before the email form.
export default function GoogleButton({ next, back }: { next: string; back: 'signup' | 'login' }) {
  return (
    <>
      <form method="post" action="/auth/google" className="oauth">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="back" value={back} />
        <button type="submit" className="btn btn-secondary oauth-btn" data-event={back === 'signup' ? 'signup_initiated' : undefined}>
          Continue with Google
        </button>
      </form>
      <p className="oauth-or" aria-hidden="true">
        <span>or with your email</span>
      </p>
    </>
  )
}
