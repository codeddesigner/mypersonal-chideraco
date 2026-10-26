import { createClient } from '@/lib/supabase/server'
import { forbidden, isSameOrigin, redirectTo } from '@/lib/http'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  const form = await request.formData()
  const password = String(form.get('password') ?? '')
  const confirm = String(form.get('confirm') ?? '')

  if (password.length < 8) return redirectTo(request, '/reset-password', { error: 'Use at least 8 characters.' })
  if (password !== confirm) return redirectTo(request, '/reset-password', { error: 'The two passwords don’t match.' })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirectTo(request, '/forgot-password', { error: 'Your reset has expired. Ask for a new code.' })

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return redirectTo(request, '/reset-password', { error: error.message })

  return redirectTo(request, '/account', { message: 'Your password has been updated.' })
}
