'use client'

import { type ComponentProps, lazy, Suspense } from 'react'

import type { WoodSamplesView } from './WoodSamplesView'

// Client-side split point. Next ships every client component a page imports in that page's chunks (even through a
// server-side next/dynamic), so the island sits behind React.lazy here: only guides that render the block fetch it.
// React.lazy rather than next/dynamic, whose loader runtime alone would add ~2.4 KB to every guide.
const View = lazy(() => import('./WoodSamplesView').then((m) => ({ default: m.WoodSamplesView })))

export function WoodSamplesLazy(props: ComponentProps<typeof WoodSamplesView>) {
  return (
    <Suspense>
      <View {...props} />
    </Suspense>
  )
}
