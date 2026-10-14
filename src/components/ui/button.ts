// Shared button classes (anchors and buttons). Tap targets ≥48px; action green passes AA (5.4:1 with white).
const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] px-5 font-[family-name:var(--font-display)] text-[0.98rem] font-semibold transition-colors duration-150 disabled:opacity-60'

export const buttonClass = {
  primary: `${base} bg-action text-white hover:bg-action-deep`,
  whatsapp: `${base} bg-whatsapp text-white hover:bg-action-deep`,
  outline: `${base} border border-ink/20 bg-paper text-ink hover:border-ink/40 hover:bg-mist`,
  onPhoto: `${base} border border-white/70 bg-white/10 text-white hover:bg-white/20`,
  quiet: `${base} px-3 text-action hover:bg-mist`,
} as const
export type ButtonVariant = keyof typeof buttonClass
