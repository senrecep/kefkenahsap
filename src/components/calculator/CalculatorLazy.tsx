'use client'

import { lazy, Suspense } from 'react'

import type { CalculatorProps } from './Calculator'

// Client-side split point (WoodSamplesLazy pattern): the server still renders the form's HTML, while the island's JS
// is its own chunk, fetched by this page only. The PNG export is split again and loads on its first click.
const View = lazy(() => import('./Calculator').then((m) => ({ default: m.Calculator })))

export function CalculatorLazy(props: CalculatorProps) {
  return (
    <Suspense>
      <View {...props} />
    </Suspense>
  )
}
