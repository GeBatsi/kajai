import axios from 'axios'
import { apiClient, getApiErrorMessage } from './api'

export const ADMIN_ROLES = ['USER', 'MODERATOR', 'ADMIN'] as const
export type AdminRole = typeof ADMIN_ROLES[number]
export interface UserSummary {
  id: string; email: string; name: string | null; image: string | null
  role: AdminRole | 'GUEST'; isVerified: boolean; createdAt: string; updatedAt: string
}
export interface AdminUser extends UserSummary { bannedAt: string | null; banReason: string | null }
export interface UsersFilter { search: string; role: AdminRole | ''; status: 'active' | 'banned' | ''; page: number; limit: 20 | 50 | 100 }
export interface UsersPage { data: AdminUser[]; meta: { page: number; limit: number; total: number; totalPages: number } }
export interface CreateAdminUser { email: string; name?: string; role: AdminRole; password?: string }
export interface EditAdminUser { name: string | null; image: string | null }

export const adminUserKeys = {
  all: ['admin', 'users'] as const,
  scope: (actorId: string) => ['admin', 'users', actorId] as const,
  list: (actorId: string, filters: UsersFilter) => ['admin', 'users', actorId, 'list', filters] as const,
  detail: (actorId: string, id: string) => ['admin', 'users', actorId, 'detail', id] as const,
}
const userPath = (id: string) => `/users/${encodeURIComponent(id)}`
export const adminUsersApi = {
  async list(filters: UsersFilter, signal?: AbortSignal): Promise<UsersPage> {
    const { data } = await apiClient.get<UsersPage>('/users', { signal, params: {
      page: filters.page, limit: filters.limit,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.role ? { role: filters.role } : {}), ...(filters.status ? { status: filters.status } : {}),
    } })
    return data
  },
  async detail(id: string, signal?: AbortSignal): Promise<AdminUser> {
    return (await apiClient.get<AdminUser>(userPath(id), { signal })).data
  },
  async create(input: CreateAdminUser): Promise<UserSummary> {
    return (await apiClient.post<UserSummary>('/users', {
      email: input.email, role: input.role, ...(input.name ? { name: input.name } : {}),
      ...(input.password ? { password: input.password } : {}),
    })).data
  },
  async edit(id: string, input: EditAdminUser): Promise<UserSummary> {
    return (await apiClient.patch<UserSummary>(userPath(id), { name: input.name, image: input.image })).data
  },
  async role(id: string, role: AdminRole): Promise<AdminUser> {
    return (await apiClient.patch<AdminUser>(`${userPath(id)}/role`, { role })).data
  },
  async ban(id: string, reason: string): Promise<AdminUser> {
    return (await apiClient.post<AdminUser>(`${userPath(id)}/ban`, { reason: reason.trim() })).data
  },
  async unban(id: string): Promise<AdminUser> {
    return (await apiClient.post<AdminUser>(`${userPath(id)}/unban`, {})).data
  },
  async remove(id: string): Promise<UserSummary> {
    return (await apiClient.delete<UserSummary>(userPath(id))).data
  },
}
export function adminErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}
export function adminErrorMessage(error: unknown): string {
  const status = adminErrorStatus(error)
  if (status === 401) return 'A munkameneted lejárt. Jelentkezz be újra.'
  const fallbacks: Record<number, string> = {
    400: 'Ellenőrizd a megadott mezőket.', 403: 'Nincs jogosultságod ehhez a művelethez.',
    404: 'A felhasználó már nem található.', 409: 'A művelet ütközik a jelenlegi állapottal. Frissítsd az adatokat.',
    500: 'A szerver nem tudta teljesíteni a kérést. Próbáld újra később.',
  }
  if (status && status >= 500) return fallbacks[500]
  return getApiErrorMessage(error, fallbacks[status ?? 0] ?? 'Nem sikerült kapcsolódni a szerverhez. Ellenőrizd a kapcsolatot.')
}
