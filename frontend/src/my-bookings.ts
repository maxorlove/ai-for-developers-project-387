import { isGuestBooking } from './guest-bookings.ts'
import { showUpcomingBookings } from './upcoming-bookings.ts'

await showUpcomingBookings(isGuestBooking)
