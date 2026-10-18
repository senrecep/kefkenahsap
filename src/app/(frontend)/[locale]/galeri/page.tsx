import { generateMetadata as metadata, GalleryPage } from './view'

// #211: the bare URL is ISR. A query (?kategori, ?etiket, ?sayfa) is rewritten by proxy.ts to /_q/galeri, which renders
// the same view per request: reading searchParams here would make every visit dynamic.
type Props = { params: Parameters<typeof GalleryPage>[0]['params'] }
const none = Promise.resolve({})

export const generateMetadata = ({ params }: Props) => metadata({ params, searchParams: none })
export default function Page({ params }: Props) {
  return <GalleryPage params={params} searchParams={none} />
}
