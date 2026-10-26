import { NextResponse } from 'next/server'

export function redirectTo(request: Request, path: string, params: Record<string, string | undefined> = {}) {
  const url = new URL(path, request.url)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  return NextResponse.redirect(url, 303)
}

// Reject cross-site form posts.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host || origin === new URL(request.url).origin
  } catch {
    return false
  }
}

export function forbidden() {
  return new NextResponse('Forbidden', { status: 403 })
}

export function originOf(request: Request): string {
  return new URL(request.url).origin
}
