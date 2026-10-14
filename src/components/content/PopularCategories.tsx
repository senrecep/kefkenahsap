import { Link } from '@/i18n/navigation'

/** Category chips for empty states (no search results, 404). */
export function PopularCategories({ categories }: { categories: { id: number; name: string; slug?: string | null }[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {categories.filter((c) => c.slug).map((c) => (
        <li key={c.id}>
          <Link href={{ pathname: '/[category]', params: { category: c.slug! } }} className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-ink hover:border-ink/40 hover:bg-mist">
            {c.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
