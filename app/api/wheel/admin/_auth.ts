export function requireWheelAdmin(req: Request) {
  const expected = (process.env.WHEEL_ADMIN_TOKEN || '').trim()
  if (!expected) {
    throw new Error('WHEEL_ADMIN_TOKEN is not configured')
  }

  const provided = (req.headers.get('x-wheel-admin-token') || '').trim()
  if (!provided || provided !== expected) {
    return false
  }
  return true
}
