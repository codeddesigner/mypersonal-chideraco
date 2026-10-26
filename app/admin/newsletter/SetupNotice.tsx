// Shown in Admin → Newsletter until the email service is fully connected.
export default function SetupNotice({ missing, testSender = false }: { missing: string[]; testSender?: boolean }) {
  if (missing.length === 0 && testSender) {
    return (
      <div className="notice" role="note" style={{ margin: '0 0 20px' }}>
        <strong>Test mode.</strong> Emails go out from Resend’s test address for now, so Send test only reaches the email your Resend
        account uses, and sending to subscribers is switched off. Once chidera.co is verified in Resend, the sender is switched to
        your own address and everything is turned on.
      </div>
    )
  }
  return (
    <div className="notice" role="note" style={{ margin: '0 0 20px' }}>
      <strong>Sending isn’t set up yet.</strong> You can write and preview newsletters, but they can’t be sent until{' '}
      {missing.map((name, i) => (
        <span key={name}>
          {i > 0 && ' and '}
          <code>{name}</code>
        </span>
      ))}{' '}
      {missing.length === 1 ? 'is' : 'are'} added in Vercel → the chidera-com project → Settings → Environment Variables, and the site
      is redeployed. The API key comes from your Resend account; the sender must be an address on a domain verified there.
    </div>
  )
}
