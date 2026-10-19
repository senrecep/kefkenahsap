'use client'

import dynamic from 'next/dynamic'

// Split point: the island's JS is its own chunk, fetched after first load, while the server still renders the form in
// place. next/dynamic rather than React.lazy (WoodSamplesLazy): a lazy() boundary streamed the form as a late hidden
// Suspense swap, a layout shift of 0.5 on Lighthouse mobile; next/dynamic preloads it on the server, so the HTML has the
// form inline (CLS 0). The PNG export is split again and loads on its first click.
export const CalculatorLazy = dynamic(() => import('./Calculator').then((m) => m.Calculator))
