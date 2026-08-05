import axios from 'axios'
import type { ActivityLevel, GoalType, UserProfile } from '@kajai/types'

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
