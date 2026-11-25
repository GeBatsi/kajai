'use client'
import Link from 'next/link'
import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Select, Input, Label } from '@kajai/ui'
import {
  correctionsApi,
  correctionKeys,
  type Filters,
  type Correction,
} from '@/lib/nutrition-corrections-api'
import {
  useCorrectionSession,
  useDebounced,
  Loading,
  ErrorPanel,
  StatusBadge,
  statusLabels,
  date,
} from './shared'
import { Comparison } from './comparison'
export function CorrectionList({ moderator = false }: { moderator?: boolean }) {
  const s = useCorrectionSession(moderator)
  const [filters, setFilters] = useState<Filters>({
    status: moderator ? 'PENDING' : '',
    page: 1,
    limit: 20,
  })
  const [foodId, setFoodId] = useState('')
  const food = useDebounced(foodId)
  const [expanded, setExpanded] = useState<string | null>(null)
  const effective = { ...filters, ...(moderator ? { foodItemId: food } : {}) }
  const query = useQuery({
    queryKey: moderator
      ? correctionKeys.moderation(s.actorId, effective)
      : correctionKeys.mine(s.actorId, effective),
    queryFn: ({ signal }) =>
      moderator ? correctionsApi.list(effective, signal) : correctionsApi.mine(effective, signal),
    enabled: s.allowed,
    retry: false,
  })
  const change = (values: Partial<Filters>) => {
    setFilters({ ...filters, ...values, page: 1 })
    setExpanded(null)
  }
  if (!s.allowed) return null
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">
          {moderator ? 'Javaslatok moderálása' : 'Saját javaslataim'}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {moderator
            ? 'A függő javaslatokat a legrégebbiekkel kezdjük.'
            : 'A legújabb beküldéseid és a moderáció eredménye.'}
        </p>
      </header>
      <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="correction-status">Státusz</Label>
          <Select
            id="correction-status"
            value={filters.status}
            onChange={(e) => change({ status: e.target.value as Filters['status'] })}
          >
            {!moderator && <option value="">Összes</option>}
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="correction-limit">Oldalméret</Label>
          <Select
            id="correction-limit"
            value={filters.limit}
            onChange={(e) => change({ limit: Number(e.target.value) })}
          >
            {[20, 50, 100].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
        </div>
        {moderator && (
          <>
            <div>
              <Label htmlFor="filter-food">Élelmiszer-azonosító</Label>
              <Input
                id="filter-food"
                value={foodId}
                onChange={(e) => {
                  setFoodId(e.target.value)
                  change({})
                }}
              />
            </div>
            {(['submittedFrom', 'submittedTo'] as const).map((key, i) => (
              <div key={key}>
                <Label htmlFor={key}>{i ? 'Záró időpont (UTC)' : 'Kezdő időpont (UTC)'}</Label>
                <Input
                  id={key}
                  type="datetime-local"
                  value={filters[key]?.slice(0, 16) ?? ''}
                  onChange={(e) => change({ [key]: e.target.value ? e.target.value + ':00Z' : '' })}
                />
              </div>
            ))}
          </>
        )}
      </Card>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p role="status">
            {query.data.meta.total} találat · {query.data.meta.page}. oldal /{' '}
            {Math.max(1, query.data.meta.totalPages)}
          </p>
          {!query.data.data.length ? (
            <Card className="p-6">Nincs a szűrésnek megfelelő javaslat.</Card>
          ) : (
            <table className="block w-full text-left md:table md:table-fixed">
              <caption className="sr-only">Javaslatok</caption>
              <thead className="hidden md:table-header-group">
                <tr className="bg-muted">
                  {['Élelmiszer és indoklás', 'Állapot és beküldés', 'Elbírálás', 'Műveletek'].map(
                    (label) => (
                      <th key={label} scope="col" className="p-4">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="block space-y-3 md:table-row-group md:space-y-0">
                {query.data.data.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="block rounded-card border border-border bg-card align-top md:table-row">
                      <td className="block break-words p-4 md:table-cell">
                        <h2 className="font-semibold">
                          {row.foodItem?.name ?? 'Törölt élelmiszer'}
                        </h2>
                        {moderator && (
                          <p className="text-sm text-muted-foreground">
                            {row.submittedBy?.name ?? 'Törölt felhasználó'}
                          </p>
                        )}
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.reason}</p>
                      </td>
                      <td className="block p-4 md:table-cell">
                        <StatusBadge status={row.status} />
                        <p className="mt-2 text-sm">Beküldve: {date(row.submittedAt)}</p>
                      </td>
                      <td className="block break-words p-4 text-sm md:table-cell">
                        {row.reviewedAt && <p>Elbírálva: {date(row.reviewedAt)}</p>}
                        {row.rejectionReason && (
                          <p className="whitespace-pre-wrap">
                            Elutasítás indoka: {row.rejectionReason}
                          </p>
                        )}
                      </td>
                      <td className="block p-4 md:table-cell">
                        {moderator ? (
                          <Button asChild variant="outline">
                            <Link
                              href={
                                '/moderator/nutrition-corrections/' + encodeURIComponent(row.id)
                              }
                            >
                              Részletek
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            aria-expanded={expanded === row.id}
                            onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                          >
                            Részletek
                          </Button>
                        )}
                      </td>
                    </tr>
                    {!moderator && expanded === row.id && (
                      <tr className="block md:table-row">
                        <td colSpan={4} className="block md:table-cell">
                          <OwnDetails row={row} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={filters.page <= 1 || query.isFetching}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            >
              Előző
            </Button>
            <Button
              variant="outline"
              disabled={filters.page >= query.data.meta.totalPages || query.isFetching}
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            >
              Következő
            </Button>
            {filters.page > 1 && (
              <Button variant="ghost" onClick={() => change({})}>
                Első oldal
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
function OwnDetails({ row }: { row: Correction }) {
  return (
    <div className="mt-5">
      <Comparison original={row.originalNutrition} proposed={row.proposedNutrition} />
    </div>
  )
}
