import type tr from '../../../messages/tr/calculator.json'

/** The calculator's strings, translated on the server and passed as a prop (no next-intl runtime in the island, #52). */
export type CalcUi = (typeof tr)['Calculator']['ui'] & { title: string }

/** Fills `{name}` placeholders of a message (the island has no ICU formatter). */
export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(vars[k] ?? m))
