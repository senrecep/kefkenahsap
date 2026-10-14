import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'

// Reading typography for guide bodies (Read mode): 65–75ch measure, more space above headings than below.
const prose =
  'max-w-[68ch] text-[1.0625rem] leading-[1.7] md:text-[1.125rem] ' +
  '[&_h2]:mt-14 [&_h2]:mb-4 [&_h2]:scroll-mt-24 [&_h2]:text-[clamp(1.4rem,2.4vw,1.75rem)] ' +
  '[&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:text-xl ' +
  '[&_p]:mt-4 [&_ul]:mt-4 [&_ol]:mt-4 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-6 [&_ol]:ps-6 [&_li]:mt-2 [&_li]:ps-1 ' +
  '[&_a]:text-action [&_a]:underline [&_a:hover]:text-action-deep [&_strong]:font-semibold ' +
  '[&>*:first-child]:mt-0'

/** Lexical body with H2 anchor ids from the same `idOf` that built the TOC, and tables in the site's hairline style. */
export function GuideBody({ data, idOf, tableLabel }: { data: SerializedEditorState; idOf: (node: unknown) => string | undefined; tableLabel: string }) {
  const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
    ...defaultConverters,
    heading: ({ node, nodesToJSX }) => {
      const Tag = (['h2', 'h3', 'h4'].includes(node.tag) ? node.tag : 'h3') as 'h2' | 'h3' | 'h4'
      return <Tag id={idOf(node)}>{nodesToJSX({ nodes: node.children })}</Tag>
    },
    table: ({ node, nodesToJSX }) => (
      <div className="mt-6 overflow-x-auto rounded-[var(--radius-control)] border border-line" tabIndex={0} role="region" aria-label={tableLabel}>
        <table className="w-full border-collapse text-[0.95rem] leading-snug [font-variant-numeric:tabular-nums]">
          <tbody>{nodesToJSX({ nodes: node.children })}</tbody>
        </table>
      </div>
    ),
    tablerow: ({ node, nodesToJSX }) => <tr className="border-b border-line last:border-b-0">{nodesToJSX({ nodes: node.children })}</tr>,
    tablecell: ({ node, nodesToJSX }) => {
      const header = (node.headerState ?? 0) > 0
      const Cell = header ? 'th' : 'td'
      return (
        <Cell
          scope={header ? 'col' : undefined}
          className={`px-3 py-2.5 text-start align-top [&_p]:m-0 ${header ? 'bg-mist font-[family-name:var(--font-display)] text-[0.85rem] font-semibold' : ''}`}
        >
          {nodesToJSX({ nodes: node.children })}
        </Cell>
      )
    },
  })
  return (
    <div className={prose}>
      <RichText data={data} converters={converters} disableContainer />
    </div>
  )
}
