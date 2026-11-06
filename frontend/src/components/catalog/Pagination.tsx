interface Props {
  page: number
  pages: number
  onChange: (page: number) => void
}

// 1 … 4 5 [6] 7 8 … 20
function pageItems(page: number, pages: number): (number | 'gap')[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))
  const sorted = [...wanted].sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('gap')
    out.push(n)
  })
  return out
}

export function Pagination({ page, pages, onChange }: Props) {
  if (pages <= 1) return null
  return (
    <nav className="pagination" aria-label="Сторінки">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Назад</button>
      {pageItems(page, pages).map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} className="pagination-gap" aria-hidden="true">…</span>
        ) : (
          <button key={item} type="button" className={item === page ? 'current' : ''}
            aria-current={item === page ? 'page' : undefined} onClick={() => onChange(item)}>
            {item}
          </button>
        ),
      )}
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Далі →</button>
    </nav>
  )
}
