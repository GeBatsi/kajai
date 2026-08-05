'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateMyProfile } from '@/lib/api'
import { ACTIVITY_LEVEL_OPTIONS, GENDER_OPTIONS, GOAL_TYPE_OPTIONS } from '@/lib/profile-labels'
import type { ActivityLevel, GoalType } from '@kajai/types'

const STEP_TITLES = ['Alapadatok', 'Aktivitás szint', 'Cél', 'Összegzés']

const inputClass =
  'w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-500 focus:outline-none'

export default function OnboardingPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)

  const [gender, setGender] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('SEDENTARY')
  const [goalType, setGoalType] = useState<GoalType>('MAINTENANCE')

  const mutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        gender,
        dateOfBirth,
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        activityLevel,
        goalType,
      }),
    onSuccess: (updated) => queryClient.setQueryData(['profile'], updated),
  })

  const step1Valid = gender && dateOfBirth && heightCm && weightKg

  function goNext() {
    const next = step + 1
    setStep(next)
    if (next === 3) mutation.mutate()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          {STEP_TITLES.map((title, i) => (
            <div key={title} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-gray-900' : 'bg-gray-200'}`} />
          ))}
        </div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
          {step + 1}. lépés / {STEP_TITLES.length}
        </p>
        <h1 className="mb-6 text-xl font-bold text-gray-900">{STEP_TITLES[step]}</h1>

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(opt.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    gender === opt.value
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Születési dátum
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={inputClass}
              />
            </label>
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
        )}

        {step === 1 && (
          <div className="flex flex-col gap-2">
            {ACTIVITY_LEVEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setActivityLevel(opt.value)}
                className={`rounded-lg border px-4 py-3 text-left transition ${
                  activityLevel === opt.value
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className={`text-xs ${activityLevel === opt.value ? 'text-gray-300' : 'text-gray-500'}`}>
                  {opt.hint}
                </p>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-2">
            {GOAL_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGoalType(opt.value)}
                className={`rounded-lg border px-4 py-3 text-left transition ${
                  goalType === opt.value
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className={`text-xs ${goalType === opt.value ? 'text-gray-300' : 'text-gray-500'}`}>{opt.hint}</p>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            {mutation.isPending && <p className="text-sm text-gray-500">Számítás folyamatban...</p>}
            {mutation.isError && (
              <p className="text-sm text-red-600">Hiba történt a profil mentése közben. Próbáld újra.</p>
            )}
            {mutation.isSuccess && mutation.data.dailyKcal && (
              <div className="grid grid-cols-2 gap-3">
                <SummaryStat label="Napi kalóriakeret" value={`${mutation.data.dailyKcal} kcal`} />
                <SummaryStat label="TDEE" value={`${mutation.data.tdeeKcal} kcal`} />
                <SummaryStat label="Fehérje" value={`${mutation.data.proteinG} g`} />
                <SummaryStat label="Szénhidrát" value={`${mutation.data.carbsG} g`} />
                <SummaryStat label="Zsír" value={`${mutation.data.fatG} g`} />
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Vissza
            </button>
          ) : (
            <span />
          )}

          {step < 3 && (
            <button
              type="button"
              disabled={step === 0 && !step1Valid}
              onClick={goNext}
              className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tovább
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              disabled={!mutation.isSuccess}
              onClick={() => router.push('/')}
              className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Kezdés
            </button>
          )}
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
