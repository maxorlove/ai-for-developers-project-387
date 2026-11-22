const prefix = 'call-calendar:booking:'

export function rememberBooking(id: string) {
  try {
    localStorage.setItem(prefix + id, '1')
    return true
  } catch {
    return false
  }
}

export function isGuestBooking(id: string) {
  return localStorage.getItem(prefix + id) !== null
}
