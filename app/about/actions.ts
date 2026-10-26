'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ACCESS_COOKIE, normaliseCode } from '@/lib/about'
import { checkCode } from '@/lib/about-private'

export type GateState = { error: string } | null

const THIRTY_DAYS = 60 * 60 * 24 * 30

// Checks a visitor's access code for Personal life. Wrong tries are counted per visitor
// and across the site, and the box pauses when there are too many, so codes can't be guessed.
export async function unlockPersonal(_previous: GateState, formData: FormData): Promise<GateState> {
  const code = normaliseCode(formData.get('code'))
  if (!code) return { error: 'Enter all five letters of your code.' }

  const result = await checkCode(code, true)
  if (result.status === 'error') return { error: 'The code couldn’t be checked just now. Try again in a minute.' }
  if (result.status === 'locked') return { error: 'Too many wrong codes have been tried. Wait 15 minutes, then try again.' }
  if (result.status !== 'ok') return { error: 'That code doesn’t work. Check the letters and try again.' }

  const store = await cookies()
  store.set(ACCESS_COOKIE, code, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: THIRTY_DAYS })
  redirect('/about?view=personal')
}

// Forgets the code on this device.
export async function lockPersonal() {
  const store = await cookies()
  store.delete(ACCESS_COOKIE)
  redirect('/about?view=personal')
}
