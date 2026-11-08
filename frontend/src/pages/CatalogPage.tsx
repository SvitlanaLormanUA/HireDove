import { HeaderTools } from '../components/HeaderTools'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  EMPTY_FILTERS,
  fetchFilterOptions,
  hasActiveFilters,
  parseFilters,
  searchVacancies,
  toSearchParams,
  type CatalogFilters,
  type FilterOptions,
  type VacancyPage,
} from '../api/vacancies'
import { useAuth } from '../auth/useAuth'
import { FiltersPanel } from '../components/catalog/FiltersPanel'
import { Pagination } from '../components/catalog/Pagination'
import { VacancyCard } from '../components/catalog/VacancyCard'
import './catalog.css'

interface ResultState {
  key: string | null // which request this state belongs to; differs from the current key while loading
  error: string | null
  data: VacancyPage | null
}

const NO_OPTIONS: FilterOptions = { locations: [], industries: [] }

function vacanciesWord(n: number): string {
  const last = n % 10
  const lastTwo = n % 100
  if (last === 1 && lastTwo !== 11) return 'вакансія'
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'вакансії'
  return 'вакансій'
}

export function CatalogPage() {
  const { user } = useAuth()
  // The URL is the single source of truth: filters survive refresh, back button and sharing.
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

  const [qInput, setQInput] = useState(filters.q)
  const [options, setOptions] = useState<FilterOptions>(NO_OPTIONS)
  const [result, setResult] = useState<ResultState>({ key: null, error: null, data: null })
  const [retry, setRetry] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const update = useCallback(
    (patch: Partial<CatalogFilters>, replace = false) => {
      setSearchParams(
        (prev) => {
          const current = parseFilters(prev)
          // Any filter change goes back to page 1; only an explicit `page` in the patch overrides.
          return toSearchParams({ ...current, page: 1, ...patch })
        },
        { replace },
      )
    },
    [setSearchParams],
  )

  // Debounce the search box (400 ms) before it reaches the URL / API.
  useEffect(() => {
    if (qInput === filters.q) return
    const t = setTimeout(() => update({ q: qInput }, true), 400)
    return () => clearTimeout(t)
  }, [qInput, filters.q, update])

  // Keep the input in sync when the URL changes from outside (back button, "reset").
  const [prevQ, setPrevQ] = useState(filters.q)
  if (prevQ !== filters.q) {
    setPrevQ(filters.q)
    setQInput(filters.q)
  }

  useEffect(() => {
    fetchFilterOptions().then(setOptions).catch(() => {
      /* dropdowns just stay empty; the search itself still works */
    })
  }, [])

  const requestKey = `${toSearchParams(filters).toString()}#${retry}`
  const loading = result.key !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    searchVacancies(filters, controller.signal)
      .then((data) => setResult({ key: requestKey, error: null, data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof ApiError ? err.message : 'Не вдалося завантажити вакансії. Перевірте з’єднання.'
        // Keep the previous list on screen, just show the error above it.
        setResult((prev) => ({ ...prev, key: requestKey, error: message }))
      })
    return () => controller.abort()
  }, [filters, requestKey])

  // Page number from the URL is beyond the last page (e.g. old link) -> jump to the last one.
  const lastPage = result.data?.pages ?? 0
  useEffect(() => {
    if (!loading && lastPage > 0 && filters.page > lastPage) update({ page: lastPage }, true)
  }, [loading, lastPage, filters.page, update])

  const reset = () => {
    setQInput('')
    setSearchParams(toSearchParams(EMPTY_FILTERS))
  }

  const { data, error } = result
  const filtered = hasActiveFilters(filters)

  return (
    <div className="catalog">
      <header className="catalog-header">
        <Link to="/" className="catalog-logo">HireDove</Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <HeaderTools />
          {user ? (
            <>
              {user.role === 'employer' && (
                <Link
                  to="/employer/vacancies/new"
                  className="button-link"
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.875rem', borderRadius: 8, margin: 0 }}
                >
                  + Опублікувати вакансію
                </Link>
              )}
              <Link to="/dashboard">Кабінет</Link>
            </>
          ) : (
            <>
              <Link to="/login">Увійти</Link>
              <Link to="/register">Реєстрація</Link>
            </>
          )}
        </nav>
      </header>

      <section className="catalog-hero">
        <h1>Знайдіть вакансію чи стажування</h1>
        <form role="search" className="search-bar" onSubmit={(e) => { e.preventDefault(); update({ q: qInput }, true) }}>
          <label htmlFor="q" className="visually-hidden">Пошук вакансій</label>
          <input id="q" type="search" value={qInput} maxLength={100}
            placeholder="Посада, компанія або ключове слово"
            onChange={(e) => setQInput(e.target.value)} />
          <button type="submit" className="primary">Шукати</button>
        </form>
      </section>

      <div className="catalog-body">
        <aside className="catalog-sidebar">
          <button type="button" className="filters-toggle" aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}>
            Фільтри {filtersOpen ? '▲' : '▼'}
          </button>
          <div className={filtersOpen ? 'filters-wrap open' : 'filters-wrap'}>
            <FiltersPanel filters={filters} options={options} onChange={(patch) => update(patch)} onReset={reset} />
          </div>
        </aside>

        <main className="catalog-results" aria-busy={loading}>
          {error && (
            <div className="form-alert" role="alert">
              <span>{error}</span>
              <button type="button" className="link-button" onClick={() => setRetry((n) => n + 1)}>
                Спробувати ще раз
              </button>
            </div>
          )}

          {data && !error && (
            <p className="results-count" aria-live="polite">
              Знайдено {data.total} {vacanciesWord(data.total)}
            </p>
          )}

          {loading && !data && <p className="centered">Завантаження…</p>}

          {data && data.items.length > 0 && (
            <div className={loading ? 'vacancy-list is-loading' : 'vacancy-list'}>
              {data.items.map((v) => <VacancyCard key={v.id} vacancy={v} />)}
            </div>
          )}

          {data && data.total === 0 && !error && (
            <div className="empty-state">
              <h2>Нічого не знайдено</h2>
              <p>{filtered ? 'Спробуйте змінити запит або прибрати частину фільтрів.' : 'Вакансій поки немає. Заходьте пізніше!'}</p>
              {filtered && <button type="button" className="primary" onClick={reset}>Скинути фільтри</button>}
            </div>
          )}

          {data && (
            <Pagination page={data.page} pages={data.pages} onChange={(page) => {
              update({ page })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }} />
          )}
        </main>
      </div>
    </div>
  )
}
