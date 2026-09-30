import axios from 'axios'
import type { ActivityLevel, GoalType, UserProfile } from '@kajai/types'

// A NestJS ValidationPipe egy string[]-t ad vissza `message` mezőben,
// egyéb hibáknál (pl. 500) egyetlen stringet – ezt egységesítjük a UI számára.
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    if (Array.isArray(message)) return message.join(' ')
    if (typeof message === 'string') return message
  }
  return fallback
}

export const apiClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  withCredentials: true,
})

export interface UpdateProfileInput {
  gender?: string
  dateOfBirth?: string
  heightCm?: number
  weightKg?: number
  bodyFatPct?: number
  activityLevel?: ActivityLevel
  goalType?: GoalType
}

export async function getMyProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>('/users/me/profile')
  return data
}

export async function updateMyProfile(input: UpdateProfileInput): Promise<UserProfile> {
  const { data } = await apiClient.patch<UserProfile>('/users/me/profile', input)
  return data
}
