// /<locale>/projeler?… (rewritten by proxy.ts, #211): the filtered project list, rendered per request.
export { generateMetadata, ProjectsPage as default } from '../../projeler/view'

// Per request by design: the query string is the content (the layout's generateStaticParams would make it static).
export const dynamic = 'force-dynamic'
