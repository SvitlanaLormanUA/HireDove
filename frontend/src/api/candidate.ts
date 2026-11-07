import { api, ApiError } from './client'
import type { VacancyCardData } from './vacancies'

export interface CandidateProfile {
  id: number
  full_name: string
  email: string
  phone: string
  location: string
  education: string
  skills: string
  description: string
  has_avatar: boolean
}
export type ProfileWrite = Omit<CandidateProfile, 'id' | 'email' | 'has_avatar'>
export interface ResumeEntry { name: string; detail: string; period: string; description: string }
export interface ResumeWrite {
  title: string
  summary: string
  education: ResumeEntry[]
  experience: ResumeEntry[]
  projects: ResumeEntry[]
  skills: string[]
  languages: string[]
  additional_information: string
}
export interface Resume extends ResumeWrite { id: number; created_at: string; updated_at: string | null }

async function optional<T>(path: string): Promise<T | null> {
  try { return await api<T>(path) }
  catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error }
}
export const fetchProfile = () => optional<CandidateProfile>('/candidate/profile')
export const saveProfile = (data: ProfileWrite) => api<CandidateProfile>('/candidate/profile', { method: 'PUT', body: JSON.stringify(data) })
export const deleteProfile = () => api<void>('/candidate/profile', { method: 'DELETE' })
export const fetchResume = () => optional<Resume>('/candidate/resume')
export const saveResume = (data: ResumeWrite, exists: boolean) => api<Resume>('/candidate/resume', { method: exists ? 'PUT' : 'POST', body: JSON.stringify(data) })
export const deleteResume = () => api<void>('/candidate/resume', { method: 'DELETE' })
export const fetchSaved = () => api<VacancyCardData[]>('/candidate/saved-vacancies')
export const saveVacancy = (id: number) => api<void>(`/candidate/saved-vacancies/${id}`, { method: 'PUT' })
export const removeSaved = (id: number) => api<void>(`/candidate/saved-vacancies/${id}`, { method: 'DELETE' })
export const fetchAvatar = () => api<Blob>('/candidate/profile/avatar')
export const uploadAvatar = (file: File) => {
  const body = new FormData()
  body.append('file', file)
  return api<CandidateProfile>('/candidate/profile/avatar', { method: 'POST', body })
}
export const deleteAvatar = () => api<void>('/candidate/profile/avatar', { method: 'DELETE' })
