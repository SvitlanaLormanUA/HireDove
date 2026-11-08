import { api } from './client'
import type { UserRole } from '../auth/useAuth'
import type { VacancyDetail } from './vacancies'

export interface Page<T> { items: T[]; total: number; page: number; page_size: number; pages: number }
export interface AdminUser { id: number; full_name: string; role: UserRole; is_active: boolean; created_at: string }
export interface AuditRecord { id: number; admin_id: number; action: string; target_type: string; target_id: number; reason: string | null; created_at: string }
export interface Notification { id: number; type: string; title: string; message: string; related_type: string | null; related_id: number | null; created_at: string; read_at: string | null }

export const fetchUsers = (query: string) => api<Page<AdminUser>>(`/admin/users?${query}`)
export const fetchModerationVacancies = (query: string) => api<Page<VacancyDetail>>(`/admin/vacancies?${query}`)
export const fetchAudit = (query: string) => api<Page<AuditRecord>>(`/admin/audit?${query}`)
export const moderate = (resource: 'users' | 'vacancies', id: number, action: string, reason: string) =>
  api(`/admin/${resource}/${id}/${action}`, { method: 'PATCH', body: JSON.stringify({ reason }) })
export const fetchNotifications = (page = 1) => api<Page<Notification>>(`/notifications?page=${page}`)
export const fetchUnreadCount = () => api<{ count: number }>('/notifications/unread-count')
export const readNotification = (id: number) => api<Notification>(`/notifications/${id}/read`, { method: 'PATCH' })
export const readAllNotifications = () => api('/notifications/read-all', { method: 'PATCH' })
