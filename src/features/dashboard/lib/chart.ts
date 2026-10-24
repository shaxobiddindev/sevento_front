/**
 * Grafik tokenlari (dataviz palitrasi, yorug' fon). Kategoriya ranglari qat'iy tartibda —
 * validator bilan tekshirilgan (oq fonda: CVD ΔE ≥ 9,1, normal ΔE ≥ 19,6). Aqua, sariq va
 * pushti 3:1 dan past — shuning uchun qiymatlar doim ko'rinadigan legend/jadvalda ham bor.
 */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']
export const OTHER = '#898781'

export const INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  up: '#006300',
  down: '#d03b3b',
}

/** O'q belgilari uchun ixcham son: 4,74 · 950 · 12K · 1,2M (kichik summalar yaxlitlanmaydi). */
export function compact(value: number): string {
  const abs = Math.abs(value)
  const fmt = (n: number, suffix: string) =>
    `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')}${suffix}`
  if (abs >= 1_000_000) return fmt(Math.round(value / 100_000) / 10, 'M')
  if (abs >= 1_000) return fmt(Math.round(value / 100) / 10, 'K')
  if (abs >= 100) return String(Math.round(value))
  return String(Number(value.toFixed(2))).replace('.', ',')
}

/**
 * Rang obyektga bog'liq (tartib raqamiga emas): to'lov turi o'zining doimiy o'rni bo'yicha,
 * davr o'zgarsa ham rangi saqlanadi. 6 dan ortig'i — "boshqa" kulrang.
 */
export function colorFor(name: string, order: readonly string[]): string {
  const index = order.indexOf(name)
  return index >= 0 && index < SERIES.length ? SERIES[index] : OTHER
}
