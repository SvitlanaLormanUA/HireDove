import { api } from './client'
import type { ExperienceLevel, VacancyDetail, VacancyStatus, WorkFormat } from './vacancies'

export interface CompanyProfile {
  id: number
  user_id: number
  company_name: string
  tagline: string | null
  description: string | null
  website: string | null
  location: string | null
  industry: string | null
  company_size: string | null
  email: string | null
  phone: string | null
  created_at: string
  updated_at: string | null
}

export interface CompanyProfileInput {
  company_name: string
  tagline?: string | null
  description?: string | null
  website?: string | null
  location?: string | null
  industry?: string | null
  company_size?: string | null
  email?: string | null
  phone?: string | null
}

export interface VacancyInput {
  title: string
  company_name: string
  description: string
  location: string
  work_format: WorkFormat
  experience: ExperienceLevel
  industry: string
  status?: VacancyStatus
}

export interface EmployerVacanciesResponse {
  items: VacancyDetail[]
  total: number
  active_count: number
  closed_count: number
}

export async function fetchCompanyProfile(): Promise<CompanyProfile | null> {
  try {
    return await api<CompanyProfile>('/employer/profile')
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
      return null
    }
    throw err
  }
}

export function saveCompanyProfile(data: CompanyProfileInput): Promise<CompanyProfile> {
  return api<CompanyProfile>('/employer/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function fetchEmployerVacancies(status?: VacancyStatus): Promise<EmployerVacanciesResponse> {
  const query = status ? `?status=${status}` : ''
  return api<EmployerVacanciesResponse>(`/employer/vacancies${query}`)
}

export function fetchEmployerVacancy(id: number | string): Promise<VacancyDetail> {
  return api<VacancyDetail>(`/employer/vacancies/${id}`)
}

export function createVacancy(data: VacancyInput): Promise<VacancyDetail> {
  return api<VacancyDetail>('/employer/vacancies', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateVacancy(id: number | string, data: Partial<VacancyInput>): Promise<VacancyDetail> {
  return api<VacancyDetail>(`/employer/vacancies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function updateVacancyStatus(id: number | string, status: VacancyStatus): Promise<VacancyDetail> {
  return api<VacancyDetail>(`/employer/vacancies/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function deleteVacancy(id: number | string): Promise<void> {
  return api<void>(`/employer/vacancies/${id}`, {
    method: 'DELETE',
  })
}
