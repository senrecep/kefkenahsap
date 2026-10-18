import type { ElementType, ReactNode } from 'react'

/** `sizes` for an image that fills the Container: max-w-7xl (80rem) minus the px-4 / md:px-6 gutters. */
export const CONTAINER_SIZES = '(min-width: 1280px) 1232px, (min-width: 768px) calc(100vw - 3rem), calc(100vw - 2rem)'

/** Page width + side gutters used by every section. */
export function Container({ as: Tag = 'div', className = '', children }: { as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={`mx-auto w-full max-w-7xl px-4 md:px-6 ${className}`}>{children}</Tag>
}
