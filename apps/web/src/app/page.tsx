
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'

import { getMyProfile } from '@/lib/api'
import { canManageFoods } from '@/lib/food-permissions'
import { CalorieProgressBar } from '@/components/profile/calorie-progress-bar'
import { MacroDonutChart } from '@/components/profile/macro-donut-chart'
import Header from '@/components/layout/Header'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Felhasználói profil lekérése
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getMyProfile,
    enabled: status === 'authenticated',
  })

  // Átirányítás, ha nincs bejelentkezve
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [status, router])

  // Onboarding ellenőrzése
  const needsOnboarding = !!profile && !profile.dailyKcal

  useEffect(() => {
    if (status === 'authenticated' && needsOnboarding) {
      router.replace('/onboarding')
    }
  }, [status, needsOnboarding, router])

  // Betöltési állapot
  if (
    status === 'loading' ||
    (status === 'authenticated' && profileLoading)
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Betöltés...</p>
      </main>
    )
  }

  // Nincs session vagy onboarding szükséges
  if (!session || needsOnboarding) return null

  return (
    <>
      <Header onLoginClick={() => {}} />

      <main className="flex min-h-screen flex-col items-center gap-6 bg-gray-50 px-4 py-8 sm:justify-center sm:py-6">

        <h1 className="text-3xl font-bold sm:text-4xl">
          KajAI
        </h1>

        {/* Felhasználói adatok */}
        <div className="flex flex-col items-center gap-2 text-center">
          {session.user.image && (
            <Image
              src={session.user.image}
              alt="Profilkép"
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover"
            />
          )}

          <p className="font-medium">
            {session.user.name}
          </p>

          <p className="break-all text-sm text-gray-500">
            {session.user.email}
          </p>

          <p className="text-xs text-gray-400">
            Szerepkör: {session.user.role}
          </p>
        </div>

        {/* Kalória és makró diagramok */}
        {profile?.dailyKcal && (
          <div className="flex w-full max-w-3xl flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-center">
            <CalorieProgressBar
              dailyKcal={profile.dailyKcal}
            />

            {profile.proteinG !== null &&
              profile.carbsG !== null &&
              profile.fatG !== null && (
                <MacroDonutChart
                  proteinG={profile.proteinG}
                  carbsG={profile.carbsG}
                  fatG={profile.fatG}
                />
              )}
          </div>
        )}

        {/* Moderátori alapanyagkezelés */}
        {canManageFoods(session.user.role) && (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/moderator/foods/new"
              className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
            >
              Alapanyag létrehozása
            </Link>

            <Link
              href="/moderator/foods/edit"
              className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Alapanyag szerkesztés
            </Link>
          </div>
        )}

        {/* Profil beállítások */}
        <div className="flex items-center gap-4">
          <Link
            href="/settings/profile"
            className="text-sm text-gray-500 hover:underline"
          >
            Profil beállítások
          </Link>
        </div>

      </main>
    </>
  )
}
