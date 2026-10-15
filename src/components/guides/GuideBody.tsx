import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import type { ReactNode } from 'react'

import { latinRun } from '@/lib/guides/bidi'
import { isGuideLink } from '@/lib/guides/links'

// Reading typography for guide bodies (Read mode): 65–75ch measure, more space above headings than below. Tables and the
// wood samples (`data-wide`) take the wider column the page grid leaves (up to 56rem) while the text keeps its measure.
const prose =
  'text-[1.0625rem] leading-[1.7] md:text-[1.125rem] [&>*:not([data-wide])]:max-w-[68ch] [&>[data-wide]]:max-w-[56rem] ' +
  '[&_h2]:mt-14 [&_h2]:mb-4 [&_h2]:scroll-mt-24 [&_h2]:text-[clamp(1.4rem,2.4vw,1.75rem)] ' +
  '[&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:text-xl ' +
  '[&_p]:mt-4 [&_ul]:mt-4 [&_ol]:mt-4 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-6 [&_ol]:ps-6 [&_li]:mt-2 [&_li]:ps-1 ' +
  '[&_a]:text-action [&_a]:underline [&_a:hover]:text-action-deep [&_strong]:font-semibold ' +
  '[&>*:first-child]:mt-0'

// Scroll cue for a table wider than the phone: a soft edge on the inline end that the table's own end covers once
// scrolled there (background-attachment local over scroll). Functional, like the hero scrim; no JS.
const scrollCue = {
  backgroundImage: 'linear-gradient(to left, var(--color-paper) 40%, transparent), linear-gradient(to left, rgb(29 31 28 / 0.14), transparent)',
  backgroundPosition: 'right center, right center',
  backgroundSize: '2.5rem 100%, 0.875rem 100%',
  backgroundRepeat: 'no-repeat',
  backgroundAttachment: 'local, scroll',
} as const
const scrollCueRtl = { ...scrollCue, backgroundImage: scrollCue.backgroundImage.replaceAll('to left', 'to right'), backgroundPosition: 'left center, left center' }

type Cell = { headerState?: number; children?: unknown[] }
type Row = { children?: Cell[] }

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
  rtl = false,
}: {
  data: SerializedEditorState
  idOf: (node: unknown) => string | undefined
  tableLabel: string
  publishedHrefs: ReadonlySet<string>
  /** Rendered where the editor placed a `woodSamples` block. */
  woodSamples?: ReactNode
  rtl?: boolean
}) {
  const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
    ...defaultConverters,
    blocks: { woodSamples: () => woodSamples ?? null },
    text: (args) => {
      const run = latinRun((args.parent as { children?: never[] }).children ?? [], args.childIndex)
      const fallback = defaultConverters.text
      const render = (node: typeof args.node) => (typeof fallback === 'function' ? fallback({ ...args, node }) : node.text)
      if (run.isolate)
        return (
          <bdi dir="ltr">
            {render(args.node)}
            {run.tail}
          </bdi>
        )
      return render(run.skip ? { ...args.node, text: args.node.text.slice(run.skip) } : args.node)
    },
    heading: ({ node, nodesToJSX }) => {
      const Tag = (node.tag === 'h2' ? 'h2' : 'h3') as 'h2' | 'h3'
      return <Tag id={idOf(node)}>{nodesToJSX({ nodes: node.children })}</Tag>
    },
    link: (args) => {
      const url = (args.node.fields as { url?: string } | undefined)?.url ?? ''
      if (isGuideLink(url) && !publishedHrefs.has(url)) return <span>{args.nodesToJSX({ nodes: args.node.children })}</span>
      const fallback = defaultConverters.link
      return typeof fallback === 'function' ? fallback(args) : null
    },
    table: ({ node, nodesToJSX }) => {
      const rows = (node.children ?? []) as Row[]
      const hasHead = (rows[0]?.children ?? []).some((c) => (c.headerState ?? 0) > 0)
      const cells = (row: Row, head: boolean) =>
        (row.children ?? []).map((cell, i) => {
          const content = nodesToJSX({ nodes: (cell.children ?? []) as never[] })
          // The first column stays put while the rest scrolls sideways (sticky start-0, on its own ground).
          const first = i === 0 ? 'sticky start-0 z-[1] border-e border-line' : ''
          if (head) return <th key={i} scope="col" className={`bg-mist px-3 py-2.5 text-start align-bottom font-[family-name:var(--font-display)] text-[0.85rem] font-semibold [&_p]:m-0 ${first}`}>{content}</th>
          if (i === 0) return <th key={i} scope="row" className={`bg-paper px-3 py-2.5 text-start align-top font-semibold [&_p]:m-0 max-sm:min-w-[8.5rem] ${first}`}>{content}</th>
          // Short values keep a usable width; the last column (notes) gets room so rows don't balloon on a phone.
          return <td key={i} className="min-w-[6.5rem] px-3 py-2.5 text-start align-top last:min-w-[18rem] [&_p]:m-0">{content}</td>
        })
      const body = hasHead ? rows.slice(1) : rows
      return (
        <div data-wide className="mt-6 overflow-x-auto overscroll-x-contain rounded-[var(--radius-control)] border border-line" style={rtl ? scrollCueRtl : scrollCue} tabIndex={0} role="region" aria-label={tableLabel}>
          <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-[0.95rem] leading-snug [font-variant-numeric:tabular-nums] [&_tbody>tr:not(:last-child)>*]:border-b [&_thead>tr>*]:border-b [&_tr>*]:border-line">
            {hasHead && (
              <thead>
                <tr>{cells(rows[0]!, true)}</tr>
              </thead>
            )}
            <tbody>
              {body.map((row, i) => (
                <tr key={i}>
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
