import type { ElementType, ReactNode } from 'react'

/** Page width + side gutters used by every section. */
export function Container({ as: Tag = 'div', className = '', children }: { as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={`mx-auto w-full max-w-7xl px-4 md:px-6 ${className}`}>{children}</Tag>
}
