import { generateMetadata, ProjectsPage } from './view'

// #211: the bare URL is ISR; ?kategori is rewritten by proxy.ts to /_q/projeler, which renders the same view per request.
type Props = { params: Parameters<typeof ProjectsPage>[0]['params'] }

export { generateMetadata }
export default function Page({ params }: Props) {
  return <ProjectsPage params={params} searchParams={Promise.resolve({})} />
}
