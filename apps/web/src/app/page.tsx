'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { getMyProfile } from '@/lib/api'
import { CalorieProgressBar } from '@/components/profile/calorie-progress-bar'
import { MacroDonutChart } from '@/components/profile/macro-donut-chart'
import Header from '@/components/layout/Header'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getMyProfile,
    enabled: status === 'authenticated',
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  useEffect(() => {
    if (profile && !profile.dailyKcal) router.replace('/onboarding')
  }, [profile, router])

  if (status === 'loading' || (status === 'authenticated' && profileLoading)) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Betöltés...</p>
      </main>
    )
  }

  if (!session) return null

  return (<>
  <Header onLoginClick={() => {}}/>
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gray-50 px-4 py-8 sm:justify-center sm:py-6">
      <h1 className="text-3xl font-bold sm:text-4xl">KajAI</h1>
      <div className="flex flex-col items-center gap-2 text-center">
        {session.user.image && (
          <img
            src={session.user.image}
            alt="Profilkép"
            className="h-16 w-16 rounded-full"
          />
        )}
        <p className="font-medium">{session.user.name}</p>
        <p className="text-sm text-gray-500">{session.user.email}</p>
        <p className="text-xs text-gray-400">Szerepkör: {session.user.role}</p>
      </div>

      {profile?.dailyKcal && (
        <div className="flex w-full max-w-3xl flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-center">
          <CalorieProgressBar dailyKcal={profile.dailyKcal} />
          {profile.proteinG !== null && profile.carbsG !== null && profile.fatG !== null && (
            <MacroDonutChart proteinG={profile.proteinG} carbsG={profile.carbsG} fatG={profile.fatG} />
          )}
        </div>
      )}

      <div className="flex items-center gap-4">
        <Link href="/settings/profile" className="text-sm text-gray-500 hover:underline">
          Profil beállítások
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Kijelentkezés
        </button>
      </div>
    </main>
    </>
  )
}
