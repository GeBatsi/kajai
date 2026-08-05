import type { ActivityLevel, GoalType } from '@kajai/types'

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Férfi' },
  { value: 'female', label: 'Nő' },
  { value: 'other', label: 'Egyéb' },
] as const

export const ACTIVITY_LEVEL_OPTIONS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: 'SEDENTARY', label: 'Ülő életmód', hint: 'Kevés vagy semmi mozgás' },
  { value: 'LIGHTLY_ACTIVE', label: 'Enyhén aktív', hint: 'Heti 1-3 edzés' },
  { value: 'MODERATELY_ACTIVE', label: 'Mérsékelten aktív', hint: 'Heti 3-5 edzés' },
  { value: 'VERY_ACTIVE', label: 'Nagyon aktív', hint: 'Heti 6-7 edzés' },
  { value: 'EXTRA_ACTIVE', label: 'Extrém aktív', hint: 'Napi kemény edzés vagy fizikai munka' },
]

export const GOAL_TYPE_OPTIONS: { value: GoalType; label: string; hint: string }[] = [
  { value: 'WEIGHT_LOSS', label: 'Fogyás', hint: 'Kalóriadeficit, magasabb fehérjebevitel' },
  { value: 'MUSCLE_GAIN', label: 'Tömegnövelés', hint: 'Kalóriatöbblet az izomépítéshez' },
  { value: 'MAINTENANCE', label: 'Testsúly megtartása', hint: 'Kiegyensúlyozott energiabevitel' },
  { value: 'RECOMPOSITION', label: 'Testösszetétel javítása', hint: 'Enyhe deficit, magas fehérje' },
]
