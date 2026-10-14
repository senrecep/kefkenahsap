import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import type { ReactNode } from 'react'

// Reading typography for guide bodies (Read mode): 65–75ch measure, more space above headings than below.
const prose =
  'max-w-[68ch] text-[1.0625rem] leading-[1.7] md:text-[1.125rem] ' +
  '[&_h2]:mt-14 [&_h2]:mb-4 [&_h2]:scroll-mt-24 [&_h2]:text-[clamp(1.4rem,2.4vw,1.75rem)] ' +
  '[&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:text-xl ' +
  '[&_p]:mt-4 [&_ul]:mt-4 [&_ol]:mt-4 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-6 [&_ol]:ps-6 [&_li]:mt-2 [&_li]:ps-1 ' +
  '[&_a]:text-action [&_a]:underline [&_a:hover]:text-action-deep [&_strong]:font-semibold ' +
  '[&>*:first-child]:mt-0'

type Cell = { headerState?: number; children?: unknown[] }
type Row = { children?: Cell[] }
const GUIDE_LINK = /^\/[a-z]{2}\/(rehber|guides)\/[^/?#]+$/

/**
 * Lexical body: H2 anchor ids from the same `idOf` that built the TOC; tables with a header row in <thead> and the
 * first column as row headers; links to guides that are not published here render as plain text (no 404 links).
 */
export function GuideBody({
  data,
  idOf,
  tableLabel,
  publishedHrefs,
  woodSamples,
}: {
  data: SerializedEditorState
  idOf: (node: unknown) => string | undefined
  tableLabel: string
  publishedHrefs: ReadonlySet<string>
  /** Rendered where the editor placed a `woodSamples` block. */
  woodSamples?: ReactNode
}) {
  const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
    ...defaultConverters,
    blocks: { woodSamples: () => woodSamples ?? null },
    heading: ({ node, nodesToJSX }) => {
      const Tag = (node.tag === 'h2' ? 'h2' : 'h3') as 'h2' | 'h3'
      return <Tag id={idOf(node)}>{nodesToJSX({ nodes: node.children })}</Tag>
    },
    link: (args) => {
      const url = (args.node.fields as { url?: string } | undefined)?.url ?? ''
      if (GUIDE_LINK.test(url) && !publishedHrefs.has(url)) return <span>{args.nodesToJSX({ nodes: args.node.children })}</span>
      const fallback = defaultConverters.link
      return typeof fallback === 'function' ? fallback(args) : null
    },
    table: ({ node, nodesToJSX }) => {
      const rows = (node.children ?? []) as Row[]
      const hasHead = (rows[0]?.children ?? []).some((c) => (c.headerState ?? 0) > 0)
      const cells = (row: Row, head: boolean) =>
        (row.children ?? []).map((cell, i) => {
          const content = nodesToJSX({ nodes: (cell.children ?? []) as never[] })
          if (head) return <th key={i} scope="col" className="bg-mist px-3 py-2.5 text-start align-top font-[family-name:var(--font-display)] text-[0.85rem] font-semibold [&_p]:m-0">{content}</th>
          if (i === 0) return <th key={i} scope="row" className="px-3 py-2.5 text-start align-top font-semibold [&_p]:m-0">{content}</th>
          return <td key={i} className="px-3 py-2.5 text-start align-top [&_p]:m-0">{content}</td>
        })
      const body = hasHead ? rows.slice(1) : rows
      return (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-control)] border border-line" tabIndex={0} role="region" aria-label={tableLabel}>
          <table className="w-full border-collapse text-[0.95rem] leading-snug [font-variant-numeric:tabular-nums]">
            {hasHead && (
              <thead>
                <tr className="border-b border-line">{cells(rows[0]!, true)}</tr>
              </thead>
            )}
            <tbody>
              {body.map((row, i) => (
                <tr key={i} className="border-b border-line last:border-b-0">
                  {cells(row, false)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    },
  })
  return (
    <div className={prose}>
      <RichText data={data} converters={converters} disableContainer />
    </div>
  )
}
