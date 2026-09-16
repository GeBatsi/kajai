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

// Fehérjeszükséglet testtömeg-kilogrammonként (g/ttkg) – sporttáplálkozási ökölszabály.
// Deficit esetén magasabb, hogy izomvesztés nélkül lehessen fogyni.
const GOAL_PROTEIN_G_PER_KG: Record<GoalType, number> = {
  WEIGHT_LOSS: 2.2,
  MUSCLE_GAIN: 1.8,
  MAINTENANCE: 1.6,
  RECOMPOSITION: 2.2,
}

// Zsír a napi kalória %-ában (a fennmaradó kalória szénhidrátra megy).
const GOAL_FAT_PCT_OF_KCAL: Record<GoalType, number> = {
  WEIGHT_LOSS: 0.25,
  MUSCLE_GAIN: 0.25,
  MAINTENANCE: 0.3,
  RECOMPOSITION: 0.25,
}

export function calculateAge(dateOfBirth: Date): number {
  const now = new Date()
  let age = now.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = now.getMonth() - dateOfBirth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
    age--
  }
  // Védelem jövőbeli/hibás dátum ellen – a DTO validáció ezt normál esetben
  // már kiszűri, de a BMR-t így sem torzíthatja el egy negatív kor.
  return Math.max(0, age)
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

  // Fehérje: testtömeg-arányos (nem a kalóriakeret %-a), így nem torzul el
  // magasabb testsúlynál vagy nagyobb kalóriakeretnél.
  const proteinG = profile.weightKg! * GOAL_PROTEIN_G_PER_KG[profile.goalType]
  const proteinKcal = proteinG * 4

  const fatKcal = dailyKcal * GOAL_FAT_PCT_OF_KCAL[profile.goalType]
  const fatG = fatKcal / 9

  // A maradék kalória szénhidrátra megy – sosem negatív, ha a fehérje+zsír
  // kivételesen meghaladná a napi keretet.
  const carbsKcal = Math.max(0, dailyKcal - proteinKcal - fatKcal)
  const carbsG = carbsKcal / 4

  return {
    tdeeKcal: Math.round(tdeeKcal),
    dailyKcal: Math.round(dailyKcal),
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
  }
}
