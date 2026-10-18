// /<locale>/galeri?… (rewritten by proxy.ts, #211): the gallery with filters / no-JS pages, rendered per request.
export { generateMetadata, GalleryPage as default } from '../../galeri/view'

// Per request by design: the query string is the content (the layout's generateStaticParams would make it static).
export const dynamic = 'force-dynamic'
