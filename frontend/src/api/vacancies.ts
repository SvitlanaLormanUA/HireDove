import { api } from './client'

export type WorkFormat = 'office' | 'remote' | 'hybrid'
export type ExperienceLevel = 'none' | 'junior' | 'middle' | 'senior'
export type VacancyStatus = 'active' | 'closed'

export const WORK_FORMAT_LABELS: Record<WorkFormat, string> = {
  office: 'В офісі',
  remote: 'Віддалено',
  hybrid: 'Гібрид',
}

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  none: 'Без досвіду',
  junior: 'До 1 року',
  middle: '1–3 роки',
  senior: '3+ роки',
}

export const VACANCY_STATUS_LABELS: Record<VacancyStatus, string> = {
  active: 'Активна',
  closed: 'Закрита',
}

export interface VacancyCardData {
  id: number
  title: string
  company_name: string
  location: string
  work_format: WorkFormat
  experience: ExperienceLevel
  industry: string
  snippet: string
  created_at: string
}

export interface VacancyDetail {
  id: number
  employer_id: number
  title: string
  company_name: string
  description: string
  location: string
  work_format: WorkFormat
  experience: ExperienceLevel
  industry: string
  status: VacancyStatus
  is_hidden: boolean
  created_at: string
}

export interface VacancyPage {
  items: VacancyCardData[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface FilterOptions {
  locations: string[]
  industries: string[]
}

export interface CatalogFilters {
  q: string
  location: string
  industry: string
  workFormat: WorkFormat[]
  experience: ExperienceLevel[]
  page: number
}

export const PAGE_SIZE = 10

export const EMPTY_FILTERS: CatalogFilters = {
  q: '',
  location: '',
  industry: '',
  workFormat: [],
  experience: [],
  page: 1,
}

/** Builds the query string for GET /vacancies/search. Same param names are used in the page URL. */
export function toSearchParams(f: CatalogFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.location) p.set('location', f.location)
  if (f.industry) p.set('industry', f.industry)
  f.workFormat.forEach((v) => p.append('work_format', v))
  f.experience.forEach((v) => p.append('experience', v))
  if (f.page > 1) p.set('page', String(f.page))
  return p
}

export function parseFilters(p: URLSearchParams): CatalogFilters {
  const page = Number.parseInt(p.get('page') ?? '1', 10)
  return {
    q: p.get('q') ?? '',
    location: p.get('location') ?? '',
    industry: p.get('industry') ?? '',
    workFormat: p.getAll('work_format').filter((v): v is WorkFormat => v in WORK_FORMAT_LABELS),
    experience: p.getAll('experience').filter((v): v is ExperienceLevel => v in EXPERIENCE_LABELS),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  }
}

export function hasActiveFilters(f: CatalogFilters): boolean {
  return Boolean(f.q.trim() || f.location || f.industry || f.workFormat.length || f.experience.length)
}

export function searchVacancies(f: CatalogFilters, signal?: AbortSignal): Promise<VacancyPage> {
  const p = toSearchParams(f)
  p.set('page_size', String(PAGE_SIZE))
  return api<VacancyPage>(`/vacancies/search?${p.toString()}`, { signal })
}

export function fetchFilterOptions(): Promise<FilterOptions> {
  return api<FilterOptions>('/vacancies/filters')
}

export function fetchVacancyDetail(id: number | string): Promise<VacancyDetail> {
  return api<VacancyDetail>(`/vacancies/${id}`)
}
