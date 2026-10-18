import { CategoryPage, generateMetadata as metadata } from './view'

// #211: the bare URL is ISR (rendered on its first request, see the locale layout). ?sayfa=N
// is rewritten by proxy.ts to /_q/<category>, which renders the same view per request.
type Props = { params: Parameters<typeof CategoryPage>[0]['params'] }
const none = Promise.resolve({})

export const generateStaticParams = () => []
export const generateMetadata = ({ params }: Props) => metadata({ params, searchParams: none })
export default function Page({ params }: Props) {
  return <CategoryPage params={params} searchParams={none} />
}
