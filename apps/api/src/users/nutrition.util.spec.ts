import {
  calculateAge,
  calculateBMRKatchMcArdle,
  calculateBMRMifflinStJeor,
  calculateNutritionTargets,
  hasRequiredProfileData,
  type ProfileInput,
} from './nutrition.util'

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

function baseProfile(overrides: Partial<ProfileInput> = {}): ProfileInput {
  return {
    gender: 'male',
    dateOfBirth: new Date('1995-06-15'),
    heightCm: 180,
    weightKg: 80,
    bodyFatPct: null,
    activityLevel: 'MODERATELY_ACTIVE',
    goalType: 'MAINTENANCE',
    ...overrides,
  }
}

describe('calculateAge', () => {
  it('correctly counts a birthday that already passed this year', () => {
    const twentyYearsAgo = new Date()
    twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20)
    twentyYearsAgo.setDate(twentyYearsAgo.getDate() - 10) // biztosan elmúlt már idén
    expect(calculateAge(twentyYearsAgo)).toBe(20)
  })

  it('decrements the age if this year\'s birthday has not happened yet', () => {
    const notYetBirthday = new Date()
    notYetBirthday.setFullYear(notYetBirthday.getFullYear() - 20)
    notYetBirthday.setDate(notYetBirthday.getDate() + 10) // még nem volt idén
    expect(calculateAge(notYetBirthday)).toBe(19)
  })

  it('does not decrement on the exact birthday', () => {
    const today = new Date()
    const exactBirthday = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate())
    expect(calculateAge(exactBirthday)).toBe(30)
  })

  it('clamps a future date to age 0 instead of going negative', () => {
    expect(calculateAge(daysFromNow(365))).toBe(0)
  })
})

describe('calculateBMRMifflinStJeor', () => {
  const weightKg = 80
  const heightCm = 180
  const age = 30
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age

  it('adds +5 for male gender (english)', () => {
    expect(calculateBMRMifflinStJeor('male', weightKg, heightCm, age)).toBeCloseTo(base + 5)
  })

  it('adds +5 for male gender (hungarian, case-insensitive)', () => {
    expect(calculateBMRMifflinStJeor('Férfi', weightKg, heightCm, age)).toBeCloseTo(base + 5)
  })

  it('subtracts 161 for female gender (english)', () => {
    expect(calculateBMRMifflinStJeor('female', weightKg, heightCm, age)).toBeCloseTo(base - 161)
  })

  it('subtracts 161 for female gender (hungarian, case-insensitive)', () => {
    expect(calculateBMRMifflinStJeor('NŐ', weightKg, heightCm, age)).toBeCloseTo(base - 161)
  })

  it('averages the two offsets for an unspecified/other gender', () => {
    expect(calculateBMRMifflinStJeor('other', weightKg, heightCm, age)).toBeCloseTo(base - 78)
  })

  it('averages the two offsets when gender is null', () => {
    expect(calculateBMRMifflinStJeor(null, weightKg, heightCm, age)).toBeCloseTo(base - 78)
  })
})

describe('calculateBMRKatchMcArdle', () => {
  it('computes BMR from lean body mass', () => {
    // LBM = 80 * (1 - 0.20) = 64 kg
    expect(calculateBMRKatchMcArdle(80, 20)).toBeCloseTo(370 + 21.6 * 64)
  })

  it('treats 0% body fat as full body weight being lean mass', () => {
    expect(calculateBMRKatchMcArdle(70, 0)).toBeCloseTo(370 + 21.6 * 70)
  })
})

describe('hasRequiredProfileData', () => {
  it('is true when gender, dateOfBirth, heightCm and weightKg are all present', () => {
    expect(hasRequiredProfileData(baseProfile())).toBe(true)
  })

  it.each(['gender', 'dateOfBirth', 'heightCm', 'weightKg'] as const)(
    'is false when %s is missing',
    (field) => {
      expect(hasRequiredProfileData(baseProfile({ [field]: null }))).toBe(false)
    },
  )
})

describe('calculateNutritionTargets', () => {
  it('returns null when required profile data is missing', () => {
    expect(calculateNutritionTargets(baseProfile({ heightCm: null }))).toBeNull()
  })

  it('uses the Mifflin-St Jeor formula when body fat % is not provided', () => {
    const result = calculateNutritionTargets(baseProfile({ bodyFatPct: null }))
    expect(result?.bmrFormula).toBe('MIFFLIN_ST_JEOR')
  })

  it('uses the Katch-McArdle formula when body fat % is provided', () => {
    const result = calculateNutritionTargets(baseProfile({ bodyFatPct: 18 }))
    expect(result?.bmrFormula).toBe('KATCH_MCARDLE')
  })

  it('matches a hand-computed example (180cm/80kg/male/moderately active/maintenance)', () => {
    // BMR = 10*80 + 6.25*180 - 5*31 + 5 = 1775 (31 éves, a születésnap már elmúlt idén)
    // TDEE = 1775 * 1.55 = 2751.25
    const result = calculateNutritionTargets(
      baseProfile({ dateOfBirth: new Date(new Date().getFullYear() - 31, 0, 1) }),
    )
    expect(result?.tdeeKcal).toBe(2751)
    expect(result?.dailyKcal).toBe(2751) // MAINTENANCE: nincs eltolás
    expect(result?.proteinG).toBe(128) // 80kg * 1.6 g/ttkg
    expect(result?.fatG).toBe(92) // 2751 * 0.3 / 9
    expect(result?.carbsG).toBe(353) // a maradék kalóriából
  })

  it.each([
    ['SEDENTARY', 1.2],
    ['LIGHTLY_ACTIVE', 1.375],
    ['MODERATELY_ACTIVE', 1.55],
    ['VERY_ACTIVE', 1.725],
    ['EXTRA_ACTIVE', 1.9],
  ] as const)('applies the %s activity multiplier (%dx) to the BMR for the TDEE', (activityLevel, multiplier) => {
    const withActivity = calculateNutritionTargets(baseProfile({ activityLevel, goalType: 'MAINTENANCE' }))
    const sedentary = calculateNutritionTargets(baseProfile({ activityLevel: 'SEDENTARY', goalType: 'MAINTENANCE' }))
    const bmr = sedentary!.tdeeKcal / ACTIVITY_MULTIPLIER.SEDENTARY
    expect(withActivity?.tdeeKcal).toBe(Math.round(bmr * multiplier))
  })

  it.each([
    ['WEIGHT_LOSS', -500],
    ['MUSCLE_GAIN', 300],
    ['MAINTENANCE', 0],
    ['RECOMPOSITION', -200],
  ] as const)('shifts dailyKcal by the %s goal adjustment (%d kcal) relative to TDEE', (goalType, adjustment) => {
    const result = calculateNutritionTargets(baseProfile({ goalType }))
    expect(result?.dailyKcal).toBe(Math.max(1200, (result?.tdeeKcal ?? 0) + adjustment))
  })

  it('never lets dailyKcal drop below the 1200 kcal safety floor', () => {
    // Nagyon alacsony BMR-t generáló, apró testű, idős profil erős deficittel.
    const result = calculateNutritionTargets(
      baseProfile({
        weightKg: 40,
        heightCm: 150,
        dateOfBirth: new Date(new Date().getFullYear() - 80, 0, 1),
        goalType: 'WEIGHT_LOSS',
      }),
    )
    expect(result?.dailyKcal).toBe(1200)
  })

  it.each([
    ['WEIGHT_LOSS', 2.2],
    ['MUSCLE_GAIN', 1.8],
    ['MAINTENANCE', 1.6],
    ['RECOMPOSITION', 2.2],
  ] as const)('uses %s g/ttkg protein for the %s goal (testtömeg-arányos, nem kalória-%%)', (goalType, gPerKg) => {
    const result = calculateNutritionTargets(baseProfile({ goalType, weightKg: 80 }))
    expect(result?.proteinG).toBe(Math.round(80 * gPerKg))
  })

  it('never returns a negative carbsG even if protein+fat would exceed dailyKcal', () => {
    // Nagyon nehéz testű, magas fehérjeigényű cél + alacsony kalóriakeret-hajlam,
    // hogy a fehérje+zsír kalória elméletileg a napi keret közelébe/fölé kerüljön.
    const result = calculateNutritionTargets(
      baseProfile({ weightKg: 250, heightCm: 150, goalType: 'WEIGHT_LOSS' }),
    )
    expect(result?.carbsG).toBeGreaterThanOrEqual(0)
  })
})

// Ugyanaz az érték, mint a nutrition.util.ts-ben – csak a teszt olvashatóságáért duplikálva.
const ACTIVITY_MULTIPLIER = {
  SEDENTARY: 1.2,
  LIGHTLY_ACTIVE: 1.375,
  MODERATELY_ACTIVE: 1.55,
  VERY_ACTIVE: 1.725,
  EXTRA_ACTIVE: 1.9,
} as const
