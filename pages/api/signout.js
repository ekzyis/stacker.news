import cookie from 'cookie'
import { datePivot } from '../../lib/time'

/**
 * @param  {NextApiRequest}  req
 * @param  {NextApiResponse} res
 * @return {void}
 */
export default (req, res) => {
  // is there a cookie pointer?
  const cookiePointerName = 'multi_auth.user-id'
  const userId = req.cookies[cookiePointerName]
  // is there a session?
  const sessionCookieName = '__Secure-next-auth.session-token'
  const sessionJWT = req.cookies[sessionCookieName]

  if (!userId || !sessionJWT) {
    // no cookie pointer or no session cookie present. do nothing.
    res.status(404).end()
    return
  }

  const cookies = []

  const cookieOptions = {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    expires: datePivot(new Date(), { months: 1 })
  }
  // remove JWT pointed to by cookie pointer
  cookies.push(cookie.serialize(`multi_auth.${userId}`, '', { ...cookieOptions, expires: 0, maxAge: 0 }))

  // update multi_auth cookie
  const oldMultiAuth = b64Decode(req.cookies.multi_auth)
  const newMultiAuth = oldMultiAuth.filter(({ id }) => id !== Number(userId))
  cookies.push(cookie.serialize('multi_auth', b64Encode(newMultiAuth), { ...cookieOptions, httpOnly: false }))

  // switch to next available account
  if (!newMultiAuth.length) {
    // no next account available
    res.setHeader('Set-Cookie', cookies)
    res.status(204).end()
    return
  }

  const newUserId = newMultiAuth[0].id
  const newUserJWT = req.cookies[`multi_auth.${newUserId}`]
  res.setHeader('Set-Cookie', [
    ...cookies,
    cookie.serialize(cookiePointerName, newUserId, { ...cookieOptions, httpOnly: false }),
    cookie.serialize(sessionCookieName, newUserJWT, cookieOptions)
  ])

  res.status(201).end()
}

const b64Encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64')
const b64Decode = s => JSON.parse(Buffer.from(s, 'base64'))
