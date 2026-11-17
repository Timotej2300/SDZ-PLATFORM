/** CSV s BOM (Excel) a ochranou pred vkladaním vzorcov (=, +, -, @). */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '﻿'
  const cols = Object.keys(rows[0])
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n')
}

export function csvResponse(name: string, rows: Record<string, unknown>[]) {
  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
