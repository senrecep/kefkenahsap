// Shared button classes (anchors and buttons). Tap targets ≥48px; action green passes AA (5.4:1 with white).
const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] font-[family-name:var(--font-display)] text-[0.98rem] font-semibold transition-colors duration-150 disabled:opacity-60'

export const buttonClass = {
  primary: `${base} px-5 bg-action text-white hover:bg-action-deep`,
  whatsapp: `${base} px-5 bg-action text-white hover:bg-action-deep`,
  outline: `${base} px-5 border border-ink/20 bg-paper text-ink hover:border-ink/40 hover:bg-mist`,
  onPhoto: `${base} px-5 border border-white/70 bg-white/10 text-white hover:bg-white/20`,
  // Text link: no side padding, so it lines up with the column edge.
  quiet: `${base} text-action underline-offset-4 hover:text-action-deep hover:underline`,
} as const
export type ButtonVariant = keyof typeof buttonClass
