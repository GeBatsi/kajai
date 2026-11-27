'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Card } from '@kajai/ui'
import Header from '@/components/layout/Header'
import { recipeBookSections, type RecipeBookIcon } from '@/lib/recipe-book-navigation'

export function RecipeBookDashboard() {
  const { data: session, status } = useSession()
  const sections = status === 'authenticated' ? recipeBookSections(session?.user) : []

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <Header onLoginClick={() => {}} />
      <main className="mx-auto max-w-6xl space-y-9 px-4 py-8 pb-24 sm:px-6 sm:py-12">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            KajAI · Közös tudástár
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl">Receptkönyv</h1>
          <p className="text-muted-foreground">
            Javaslatok, visszajelzések és alapanyagok egy helyen. Válaszd ki, mivel szeretnél
            foglalkozni.
          </p>
        </div>
        {sections.length === 0 ? (
          <Card className="border border-border p-6" role="status" aria-live="polite">
            {status === 'loading' ? (
              'Jogosultság ellenőrzése…'
            ) : (
              <p>
                Aktív, bejelentkezett munkamenet szükséges.{' '}
                <Link
                  href="/login"
                  className="font-semibold text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  Bejelentkezés
                </Link>
              </p>
            )}
          </Card>
        ) : (
          sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={`recipe-book-${section.id}`}
              className="space-y-4"
            >
              <div className="space-y-1">
                <h2 id={`recipe-book-${section.id}`} className="font-heading text-2xl">
                  {section.title}
                </h2>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
              <div
                className={`grid gap-4 sm:grid-cols-2 ${section.items.length === 3 ? 'lg:grid-cols-3' : ''}`}
              >
                {section.items.map((item) => (
                  <Card
                    key={item.id}
                    className="min-w-0 border border-border transition hover:border-primary/50 hover:shadow-md"
                  >
                    <Link
                      href={item.href}
                      aria-labelledby={`recipe-book-${item.id}-title`}
                      aria-describedby={`recipe-book-${item.id}-description`}
                      className="group flex h-full flex-col items-start rounded-card p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-6"
                    >
                      <span className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                        <NavigationIcon name={item.icon} />
                      </span>
                      <h3 id={`recipe-book-${item.id}-title`} className="font-heading text-xl">
                        {item.label}
                      </h3>
                      <p
                        id={`recipe-book-${item.id}-description`}
                        className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground"
                      >
                        {item.description}
                      </p>
                      <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary">
                        Megnyitás{' '}
                        <span
                          aria-hidden="true"
                          className="transition-transform group-hover:translate-x-1"
                        >
                          →
                        </span>
                      </span>
                    </Link>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  )
}

function NavigationIcon({ name }: { name: RecipeBookIcon }) {
  const paths: Record<RecipeBookIcon, React.ReactNode> = {
    suggest: (
      <>
        <path d="M12 20H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l5 5v3M14 3v5h5" />
        <path d="m15 20 6-6-2-2-6 6-1 4 3-1ZM7 8h3M7 12h3M7 16h2" />
      </>
    ),
    list: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h1m3 0h4M8 12h1m3 0h4M8 16h1m3 0h4" />
      </>
    ),
    review: (
      <>
        <path d="M9 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3" />
        <rect x="9" y="2" width="6" height="4" rx="1" />
        <path d="m8 13 3 3 5-6" />
      </>
    ),
    ingredient: (
      <>
        <path d="M20 4C10 3 3 8 5 15c7 3 15-1 15-11ZM4 21 16 9" />
        <path d="M14 3V1m6 18v-6m-3 3h6" />
      </>
    ),
    edit: (
      <>
        <path d="m16 3 5 5-12 12H4v-5L16 3ZM13 6l5 5M3 22h18" />
      </>
    ),
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}
