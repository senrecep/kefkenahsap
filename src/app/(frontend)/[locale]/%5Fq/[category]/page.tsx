// /<locale>/<category>?… (rewritten by proxy.ts, #211): further photo pages and live preview, rendered per request.
export { generateMetadata, CategoryPage as default } from '../../[category]/view'

// Per request by design: the query string is the content (the layout's generateStaticParams would make it static).
export const dynamic = 'force-dynamic'
