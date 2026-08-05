'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyProfile, updateMyProfile } from '@/lib/api'
import { ACTIVITY_LEVEL_OPTIONS, GENDER_OPTIONS, GOAL_TYPE_OPTIONS } from '@/lib/profile-labels'
import type { ActivityLevel, GoalType } from '@kajai/types'

const inputClass =
  'w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-500 focus:outline-none'
const selectClass = inputClass + ' bg-white'

export default function ProfileSettingsPage() {
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({ queryKey: ['profile'], queryFn: getMyProfile })

  const [gender, setGender] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('SEDENTARY')
  const [goalType, setGoalType] = useState<GoalType>('MAINTENANCE')

  useEffect(() => {
    if (!profile) return
    setGender(profile.gender ?? '')
    setDateOfBirth(profile.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '')
    setHeightCm(profile.heightCm?.toString() ?? '')
    setWeightKg(profile.weightKg?.toString() ?? '')
    setBodyFatPct(profile.bodyFatPct?.toString() ?? '')
    setActivityLevel(profile.activityLevel)
    setGoalType(profile.goalType)
  }, [profile])

  const mutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        bodyFatPct: bodyFatPct ? Number(bodyFatPct) : undefined,
        activityLevel,
        goalType,
      }),
    onSuccess: (updated) => queryClient.setQueryData(['profile'], updated),
  })

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Betöltés...</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-4 inline-block text-sm text-gray-500 hover:underline">
          ← Vissza a főoldalra
        </Link>
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-xl font-bold text-gray-900">Profil beállítások</h1>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Nem
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass}>
                <option value="">Válassz</option>
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Születési dátum
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Magasság (cm)
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Testtömeg (kg)
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Testzsír % (opcionális)
              <input
                type="number"
                value={bodyFatPct}
                onChange={(e) => setBodyFatPct(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Aktivitás szint
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                className={selectClass}
              >
                {ACTIVITY_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Cél
              <select
                value={goalType}
                onChange={(e) => setGoalType(e.target.value as GoalType)}
                className={selectClass}
              >
                {GOAL_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {mutation.isSuccess && mutation.data.dailyKcal && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <SummaryStat label="Napi kalóriakeret" value={`${mutation.data.dailyKcal} kcal`} />
              <SummaryStat label="TDEE" value={`${mutation.data.tdeeKcal} kcal`} />
              <SummaryStat label="Fehérje" value={`${mutation.data.proteinG} g`} />
              <SummaryStat label="Szénhidrát" value={`${mutation.data.carbsG} g`} />
              <SummaryStat label="Zsír" value={`${mutation.data.fatG} g`} />
            </div>
          )}
          {mutation.isError && <p className="mt-4 text-sm text-red-600">Hiba történt a mentés közben.</p>}

          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="mt-6 w-full rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mutation.isPending ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </div>
    </main>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  )
}
