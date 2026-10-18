/** The items before and after `slug` in an ordered list (no wrap-around); both undefined when `slug` is not in it. */
export function neighbours<T extends { slug: string }>(list: readonly T[], slug: string): { prev?: T; next?: T } {
  const i = list.findIndex((x) => x.slug === slug)
  return i < 0 ? { prev: undefined, next: undefined } : { prev: list[i - 1], next: list[i + 1] }
}
