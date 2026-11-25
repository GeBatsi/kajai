'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, Label, Textarea } from '@kajai/ui'
import {
  correctionsApi,
  correctionKeys,
  correctionStatus,
  type CorrectionFood,
  type Correction,
} from '@/lib/nutrition-corrections-api'
import {
  normalizeNutrition,
  draftValues,
  buildCorrection,
  nutrients,
  nutrientLabels,
} from '@/lib/correction-nutrition'
import {
  useCorrectionSession,
  useCorrectionAction,
  useDebounced,
  Loading,
  ErrorPanel,
  StatusBadge,
} from './shared'
import { Comparison } from './comparison'
export function Submission({ initialFoodId = '' }: { initialFoodId?: string }) {
  const session = useCorrectionSession()
  const [selected, setSelected] = useState(initialFoodId)
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const result = useQuery({
    queryKey: [...correctionKeys.foods, 'search', debounced],
    queryFn: ({ signal }) => correctionsApi.search(debounced, signal),
    enabled: session.allowed && !selected,
    retry: false,
  })
  const food = useQuery({
    queryKey: correctionKeys.food(selected),
    queryFn: ({ signal }) => correctionsApi.food(selected, signal),
    enabled: session.allowed && !!selected,
    retry: false,
  })
  if (!session.allowed) return null
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Közösen pontosabb adatok</p>
        <h1 className="mt-2 font-heading text-3xl">Tápérték-javítás javaslata</h1>
        <p className="mt-3 text-muted-foreground">
          Válassz élelmiszert, és add meg az ellenőrizhető javítást. A változtatást moderátor
          bírálja el.
        </p>
      </header>
      {!selected ? (
        <Card className="space-y-4 p-5 sm:p-7">
          <Label htmlFor="correction-search">
            1. Élelmiszer keresése név vagy kategória alapján
          </Label>
          <Input
            id="correction-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Például csirkemell…"
          />
          <p className="text-sm text-muted-foreground">
            Legfeljebb 50 találat. Sok találatnál pontosítsd a keresést.
          </p>
          {result.isPending ? (
            <Loading />
          ) : result.isError ? (
            <ErrorPanel error={result.error} retry={() => void result.refetch()} />
          ) : (
            <>
              <p role="status">
                {result.data.length
                  ? result.data.length + ' találat'
                  : 'Nincs találat. Próbálj másik keresést.'}
              </p>
              <ul className="divide-y divide-border">
                {result.data.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.type === 'BASIC' ? 'Alapanyag' : 'Termék'} ·{' '}
                        {item.category || 'Nincs kategória'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setSelected(item.id)}
                      aria-label={item.name + ' kiválasztása'}
                    >
                      Kiválasztás
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      ) : (
        <>
          <Button variant="outline" onClick={() => setSelected('')}>
            Másik élelmiszer választása
          </Button>
          {food.isPending ? (
            <Loading />
          ) : food.isError ? (
            <ErrorPanel error={food.error} retry={() => void food.refetch()} />
          ) : (
            <CorrectionForm key={selected} food={food.data} />
          )}
        </>
      )}
    </div>
  )
}
export function CorrectionForm({ food }: { food: CorrectionFood }) {
  const [base, setBase] = useState(food)
  let original: Record<string, unknown> = {}
  let unsupported = ''
  try {
    original = normalizeNutrition(base.nutrition)
  } catch (e) {
    unsupported = (e as Error).message
  }
  const [draft, setDraft] = useState(() => draftValues(original))
  const [reason, setReason] = useState('')
  const [validation, setValidation] = useState('')
  const [preview, setPreview] = useState<ReturnType<typeof buildCorrection> | null>(null)
  const [created, setCreated] = useState<Correction | null>(null)
  const action = useCorrectionAction()
  const cache = useQueryClient()
  const { actorId } = useCorrectionSession()
  const stale =
    food.updatedAt !== base.updatedAt ||
    JSON.stringify(food.nutrition) !== JSON.stringify(base.nutrition)
  const reset = () => {
    try {
      const current = normalizeNutrition(food.nutrition)
      setBase(food)
      setDraft(draftValues(current))
      setPreview(null)
      setValidation('')
      action.reset()
    } catch (e) {
      setValidation((e as Error).message)
    }
  }
  if (created)
    return (
      <Card className="space-y-4 p-6">
        <p role="status">A szerver rögzítette a javaslatot.</p>
        <StatusBadge status={created.status} />
        <Link className="block text-primary underline" href="/nutrition-corrections/mine">
          Saját javaslataim megnyitása
        </Link>
      </Card>
    )
  return (
    <Card className="space-y-5 p-5 sm:p-7">
      <h2 className="font-heading text-2xl">2. {food.name}</h2>
      <p>
        {food.category || 'Nincs kategória'} · Tápértékek 100 {String(original.unit ?? 'g')}{' '}
        mennyiségre. Az egység nem módosítható.
      </p>
      {unsupported && (
        <p role="alert" className="text-destructive">
          {unsupported}
        </p>
      )}
      {stale && (
        <div role="alert" className="space-y-3 rounded-md bg-accent p-4 text-accent-foreground">
          <p>
            Az élelmiszer adatai megváltoztak. A szerkesztésed megmaradt. Beküldés előtt töltsd be
            az aktuális állapotot; ez lecseréli a tápértékmezőket.
          </p>
          <Button variant="outline" disabled={action.pending} onClick={reset}>
            Aktuális adatok betöltése
          </Button>
        </div>
      )}
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (stale || unsupported || action.pending) return
          try {
            setPreview(buildCorrection(original, draft, reason))
            setValidation('')
          } catch (e) {
            setValidation((e as Error).message)
          }
        }}
      >
        <p className="text-sm text-muted-foreground">
          Az üres mező ismeretlen értéket jelent; a 0 ismert nulla. Csak a tényleges változásokat
          küldjük el.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {nutrients.map((k) => (
            <div key={k} className="space-y-2">
              <Label htmlFor={'nutrient-' + k}>
                {nutrientLabels[k]} ({k === 'energyKcal' ? 'kcal' : 'g'})
              </Label>
              <Input
                id={'nutrient-' + k}
                inputMode="decimal"
                value={draft[k]}
                disabled={action.pending || !!unsupported}
                onChange={(e) => {
                  setDraft({ ...draft, [k]: e.target.value })
                  setPreview(null)
                }}
              />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="submission-reason">Indoklás és forrás (kötelező)</Label>
          <Textarea
            id="submission-reason"
            value={reason}
            maxLength={1000}
            disabled={action.pending}
            onChange={(e) => {
              setReason(e.target.value)
              setPreview(null)
            }}
          />
          <p className="text-sm text-muted-foreground">{reason.trim().length} / 1000 karakter</p>
        </div>
        {validation && (
          <p role="alert" className="text-destructive">
            {validation}
          </p>
        )}
        <Button disabled={action.pending || stale || !!unsupported} type="submit">
          Változások előnézete
        </Button>
      </form>
      {preview && (
        <section className="space-y-4" aria-label="Beküldés előnézete">
          <Comparison original={original} proposed={preview.full} />
          <Button
            disabled={action.pending || stale || !!unsupported}
            aria-busy={action.pending}
            onClick={async () => {
              if (stale || unsupported) return
              const result = await action.run(() =>
                correctionsApi.submit(food.id, preview.patch, preview.reason),
              )
              if (result) {
                setCreated(result)
                void cache.invalidateQueries({ queryKey: correctionKeys.scope(actorId) })
              }
            }}
          >
            {action.pending ? 'Beküldés…' : 'Javaslat beküldése'}
          </Button>
        </section>
      )}
      {action.error && <ErrorPanel error={action.error} />}{' '}
      {correctionStatus(action.error) === 409 && (
        <Link className="block text-primary underline" href="/nutrition-corrections/mine">
          Függő javaslataim ellenőrzése
        </Link>
      )}
    </Card>
  )
}
