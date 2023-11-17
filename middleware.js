import { NextResponse } from 'next/server'

const referrerMiddleware = (request) => {
  const regex = /(\/.*)?\/r\/([\w_]+)/
  const m = regex.exec(request.nextUrl.pathname)

  const url = new URL(m[1] || '/', request.url)
  url.search = request.nextUrl.search
  url.hash = request.nextUrl.hash

  const resp = NextResponse.redirect(url)
  resp.cookies.set('sn_referrer', m[2])
  return resp
}

const multiAuthMiddleware = (request) => {
  // switch next-auth session cookie with multi_auth cookie if cookie pointer present
  const userId = request.cookies?.get('multi_auth.user-id')?.value
  const sessionCookieName = '__Secure-next-auth.session-token'
  const hasSession = request.cookies?.has(sessionCookieName)
  if (userId && hasSession) {
    const userJWT = request.cookies.get(`multi_auth.${userId}`)?.value
    if (userJWT) request.cookies.set(sessionCookieName, userJWT)
  }
  const response = NextResponse.next({ request })
  return response
}

export function middleware (request) {
  const referrerRegexp = /(\/.*)?\/r\/([\w_]+)/
  if (referrerRegexp.test(request.nextUrl.pathname)) {
    return referrerMiddleware(request)
  }
  return multiAuthMiddleware(request)
}
