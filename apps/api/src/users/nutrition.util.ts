import type { ActivityLevel, GoalType } from '@kajai/db'

export interface ProfileInput {
  gender: string | null
  dateOfBirth: Date | null
  heightCm: number | null
  weightKg: number | null
  activityLevel: ActivityLevel
  goalType: GoalType
}

export interface NutritionTargets {
  tdeeKcal: number
  dailyKcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHTLY_ACTIVE: 1.375,
  MODERATELY_ACTIVE: 1.55,
  VERY_ACTIVE: 1.725,
  EXTRA_ACTIVE: 1.9,
}

// Cél szerinti eltolás a TDEE-hez képest (kcal/nap)
const GOAL_KCAL_ADJUSTMENT: Record<GoalType, number> = {
  WEIGHT_LOSS: -500,
  MUSCLE_GAIN: 300,
  MAINTENANCE: 0,
  RECOMPOSITION: -200,
}

// Makróarányok célonként (fehérje / szénhidrát / zsír – a napi kalória %-ában)
const GOAL_MACRO_RATIOS: Record<GoalType, { protein: number; carbs: number; fat: number }> = {
  WEIGHT_LOSS: { protein: 0.35, carbs: 0.35, fat: 0.3 },
  MUSCLE_GAIN: { protein: 0.3, carbs: 0.45, fat: 0.25 },
  MAINTENANCE: { protein: 0.25, carbs: 0.45, fat: 0.3 },
  RECOMPOSITION: { protein: 0.35, carbs: 0.35, fat: 0.3 },
}

export function calculateAge(dateOfBirth: Date): number {
  const now = new Date()
  let age = now.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = now.getMonth() - dateOfBirth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
    age--
  }
  return age
}

// Mifflin-St Jeor BMR képlet
function calculateBMR(gender: string | null, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  const normalizedGender = gender?.toLowerCase()
  if (normalizedGender === 'male' || normalizedGender === 'férfi') return base + 5
  if (normalizedGender === 'female' || normalizedGender === 'nő') return base - 161
  // Ismeretlen/egyéb nem esetén a két képlet átlaga
  return base - 78
}

export function hasRequiredProfileData(profile: ProfileInput): boolean {
  return Boolean(profile.gender && profile.dateOfBirth && profile.heightCm && profile.weightKg)
}

export function calculateNutritionTargets(profile: ProfileInput): NutritionTargets | null {
  if (!hasRequiredProfileData(profile)) return null

  const age = calculateAge(profile.dateOfBirth!)
  const bmr = calculateBMR(profile.gender, profile.weightKg!, profile.heightCm!, age)
  const tdeeKcal = bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel]

  const dailyKcal = Math.max(1200, tdeeKcal + GOAL_KCAL_ADJUSTMENT[profile.goalType])
  const ratios = GOAL_MACRO_RATIOS[profile.goalType]

  return {
    tdeeKcal: Math.round(tdeeKcal),
    dailyKcal: Math.round(dailyKcal),
    proteinG: Math.round((dailyKcal * ratios.protein) / 4),
    carbsG: Math.round((dailyKcal * ratios.carbs) / 4),
    fatG: Math.round((dailyKcal * ratios.fat) / 9),
  }
}
