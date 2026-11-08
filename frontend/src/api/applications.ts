import { api } from './client'

export type ApplicationStatus = 'new' | 'reviewed' | 'accepted' | 'rejected'

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: 'Новий',
  reviewed: 'На розгляді',
  accepted: 'Прийнято',
  rejected: 'Відхилено',
}

export interface ResumeSnapshot {
  title: string
  summary: string
  education: Array<{ name?: string; detail?: string; period?: string; description?: string }>
  experience: Array<{ name?: string; detail?: string; period?: string; description?: string }>
  projects: Array<{ name?: string; detail?: string; period?: string; description?: string }>
  skills: string[]
  languages: string[]
  additional_information: string
}

export interface ApplicationItem {
  id: number
  vacancy_id: number
  vacancy_title: string
  company_name: string
  employer_id: number
  candidate_id: number
  candidate_name: string
  candidate_email: string
  cover_letter: string
  status: ApplicationStatus
  created_at: string
  resume?: ResumeSnapshot | null
}

export interface ChatThread {
  application_id: number
  vacancy_id: number
  vacancy_title: string
  company_name: string
  partner_id: number
  partner_name: string
  status: ApplicationStatus
  unread_count: number
  last_message: string | null
  last_message_at: string | null
}

export interface ChatMessage {
  id: number
  application_id: number
  sender_id: number
  sender_name: string
  content: string
  is_read: boolean
  created_at: string
}

export function submitApplication(vacancy_id: number, cover_letter: string): Promise<ApplicationItem> {
  return api<ApplicationItem>('/applications', {
    method: 'POST',
    body: JSON.stringify({ vacancy_id, cover_letter }),
  })
}

export function fetchMyApplications(): Promise<ApplicationItem[]> {
  return api<ApplicationItem[]>('/applications/my')
}

export function fetchEmployerApplications(vacancyId?: number): Promise<ApplicationItem[]> {
  const qs = vacancyId ? `?vacancy_id=${vacancyId}` : ''
  return api<ApplicationItem[]>(`/applications/employer${qs}`)
}

export function updateApplicationStatus(
  applicationId: number,
  status: ApplicationStatus
): Promise<ApplicationItem> {
  return api<ApplicationItem>(`/applications/${applicationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function fetchChatThreads(): Promise<ChatThread[]> {
  return api<ChatThread[]>('/chats')
}

export function fetchChatMessages(applicationId: number): Promise<ChatMessage[]> {
  return api<ChatMessage[]>(`/chats/${applicationId}/messages`)
}

export function sendChatMessage(applicationId: number, content: string): Promise<ChatMessage> {
  return api<ChatMessage>(`/chats/${applicationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}