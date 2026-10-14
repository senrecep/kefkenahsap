import { notFound } from 'next/navigation'

// Any unknown path under /[locale] renders the localized 404 (not-found.tsx) with a real 404 status.
export default function CatchAll() {
  notFound()
}
