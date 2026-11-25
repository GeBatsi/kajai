'use client'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Textarea,
  Label,
} from '@kajai/ui'
import {
  correctionsApi,
  correctionKeys,
  correctionStatus,
  type Detail,
} from '@/lib/nutrition-corrections-api'
import {
  useCorrectionSession,
  useCorrectionAction,
  Loading,
  ErrorPanel,
  StatusBadge,
  date,
} from './shared'
import { Comparison } from './comparison'
export function ModerationDetail({ id }: { id: string }) {
  const s = useCorrectionSession(true)
  const started = useRef(0)
  const completed = useRef(0)
  const query = useQuery({
    queryKey: correctionKeys.detail(s.actorId, id),
    queryFn: async ({ signal }) => {
      const request = ++started.current
      const data = await correctionsApi.detail(id, signal)
      if (data.id !== id) throw new Error('Eltérő javaslat érkezett a szervertől.')
      completed.current = request
      return data
    },
    enabled: s.allowed,
    retry: false,
  })
  if (!s.allowed) return null
  if (query.isPending) return <Loading />
  if (!query.data) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />
  async function refresh() {
    const before = started.current
    const result = await query.refetch({ throwOnError: true, cancelRefetch: true })
    if (
      !result.isSuccess ||
      result.isError ||
      result.fetchStatus !== 'idle' ||
      !result.data ||
      result.data.id !== id ||
      completed.current <= before
    ) {
      throw new Error('Nem érkezett friss javaslat a szervertől.')
    }
    return result.data
  }
  return (
    <DecisionContent
      key={id}
      detail={query.data}
      refresh={refresh}
      readError={query.isError ? query.error : null}
      readPending={query.isFetching}
    />
  )
}
export function DecisionContent({
  detail: serverDetail,
  refresh,
  readError,
  readPending = false,
}: {
  detail: Detail
  refresh: () => Promise<Detail>
  readError?: unknown
  readPending?: boolean
}) {
  const [fresh, setFresh] = useState<{ source: Detail; data: Detail } | null>(null)
  const [decision, setDecision] = useState<Partial<Detail> | null>(null)
  const base = fresh?.source === serverDetail ? fresh.data : serverDetail
  const detail = decision ? { ...base, ...decision } : base
  const [unverified, setUnverified] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const currentUnverified = unverified || readError != null || readPending
  const s = useCorrectionSession(true)
  const action = useCorrectionAction(true)
  const cache = useQueryClient()
  const [dialog, setDialog] = useState<{ kind: 'approve' | 'reject'; version: string } | null>(null)
  const [notice, setNotice] = useState('')
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [reloading, setReloading] = useState(false)
  const blockedByConflict = needsRefresh || correctionStatus(action.error) === 409
  useEffect(() => {
    if (correctionStatus(action.error) === 409) setNeedsRefresh(true)
  }, [action.error])
  async function reload(expected = decision) {
    setReloading(true)
    try {
      const data = await refresh()
      if (
        !data ||
        data.id !== detail.id ||
        !['PENDING', 'APPROVED', 'REJECTED'].includes(data.status) ||
        typeof data.canApprove !== 'boolean' ||
        !Object.hasOwn(data, 'currentFood') ||
        (expected && data.status !== expected.status)
      )
        throw new Error('Nem igazoltan friss javaslat érkezett.')
      setFresh({ source: serverDetail, data })
      setDecision(null)
      setUnverified(false)
      setRefreshError('')
      action.reset()
      setNeedsRefresh(false)
    } catch {
      setRefreshError(
        'Az adatfrissítés sikertelen. A korábbi megerősítés nem használható; próbáld újra.',
      )
    } finally {
      setReloading(false)
    }
  }
  const trigger = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const fingerprint = JSON.stringify(detail)
  const canReject = detail.status === 'PENDING' && detail.submittedById !== s.actorId
  const open = (kind: 'approve' | 'reject', element: HTMLElement) => {
    if (
      blockedByConflict ||
      reloading ||
      !s.allowed ||
      (kind === 'approve' ? !detail.canApprove : !canReject)
    )
      return
    action.reset()
    trigger.current = element
    setDialog({ kind, version: fingerprint })
  }
  async function confirm(reason: string) {
    if (
      blockedByConflict ||
      reloading ||
      !dialog ||
      dialog.version !== fingerprint ||
      correctionStatus(action.error) === 409 ||
      !s.allowed ||
      (dialog.kind === 'approve' ? !detail.canApprove : !canReject)
    )
      return
    const result = await action.run(() =>
      dialog.kind === 'approve'
        ? correctionsApi.approve(detail.id)
        : correctionsApi.reject(detail.id, reason),
    )
    if (!result) return
    const confirmed = {
      ...result,
      canApprove: false,
      approvalBlockedReason: 'A javaslatot már elbírálták.',
    }
    setDecision(confirmed)
    if (result.status === 'APPROVED') setUnverified(true)
    cache.setQueryData<Detail>(correctionKeys.detail(s.actorId, detail.id), (old) =>
      old
        ? {
            ...old,
            ...result,
            canApprove: false,
            approvalBlockedReason: 'A javaslatot már elbírálták.',
          }
        : undefined,
    )
    setDialog(null)
    setNotice(
      result.status === 'APPROVED'
        ? 'A szerver jóváhagyta a javaslatot.'
        : 'A szerver rögzítette az elutasítást.',
    )
    void cache.invalidateQueries({ queryKey: correctionKeys.scope(s.actorId), refetchType: 'none' })
    if (result.status === 'APPROVED')
      void cache.invalidateQueries({ queryKey: correctionKeys.foods })
    await reload(confirmed)
  }
  return (
    <div className="space-y-6">
      <h1 ref={heading} tabIndex={-1} className="font-heading text-3xl">
        {detail.foodItem?.name ?? 'Törölt élelmiszer'} – javaslat
      </h1>
      {notice && (
        <p role="status" className="rounded-md bg-accent p-4 text-accent-foreground">
          {notice}
        </p>
      )}
      <Card className="space-y-4 p-5">
        <StatusBadge status={detail.status} />
        <p>
          Beküldő: {detail.submittedBy?.name ?? 'Törölt felhasználó'} · {date(detail.submittedAt)}
        </p>
        <p className="whitespace-pre-wrap break-words">{detail.reason}</p>
        {detail.reviewedAt && (
          <p>
            Elbírálta: {detail.reviewedBy?.name ?? 'Törölt felhasználó'} · {date(detail.reviewedAt)}
          </p>
        )}
        {detail.rejectionReason && (
          <p className="whitespace-pre-wrap break-words">
            Elutasítás indoka: {detail.rejectionReason}
          </p>
        )}
      </Card>
      {(refreshError || readError != null) && (
        <p role="alert" className="rounded-md border border-destructive/40 p-4 text-destructive">
          {refreshError || 'Az adatfrissítés sikertelen. Próbáld újra.'}
        </p>
      )}
      {currentUnverified && (
        <p role="status">
          {reloading || readPending
            ? 'Az aktuális tápértékek frissítése…'
            : 'Az aktuális tápértékek nem ellenőrzöttek. Kérj új adatfrissítést.'}
        </p>
      )}
      <Comparison
        currentState={
          currentUnverified ? (reloading || readPending ? 'loading' : 'unverified') : undefined
        }
        original={detail.originalNutrition}
        proposed={detail.proposedNutrition}
        current={detail.currentFood?.nutrition ?? null}
      />
      {detail.approvalBlockedReason && (
        <p
          role="status"
          className="rounded-md border border-border bg-accent p-4 text-accent-foreground"
        >
          {detail.approvalBlockedReason}
        </p>
      )}
      {detail.isStale && (
        <p className="text-sm text-muted-foreground">
          Technikai jelzés: az élelmiszer verziója eltér a beküldéskoritól. Függő javaslat
          indoklással továbbra is elutasítható.
        </p>
      )}
      {blockedByConflict && <p role="alert">Frissítsd az adatokat az újabb döntés előtt.</p>}
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={!detail.canApprove || action.pending || blockedByConflict || reloading}
          onClick={(e) => open('approve', e.currentTarget)}
        >
          Jóváhagyás
        </Button>
        <Button
          variant="destructive"
          disabled={!canReject || action.pending || blockedByConflict || reloading}
          onClick={(e) => open('reject', e.currentTarget)}
        >
          Elutasítás
        </Button>
        <Button
          variant="outline"
          disabled={action.pending || reloading}
          onClick={() => void reload()}
        >
          Adatok frissítése
        </Button>
      </div>
      {dialog && (
        <DecisionDialog
          detail={detail}
          kind={dialog.kind}
          pending={action.pending}
          error={action.error}
          stale={dialog.version !== fingerprint || blockedByConflict}
          onClose={() => setDialog(null)}
          refresh={() => {
            setDialog(null)
            void reload()
          }}
          confirm={confirm}
          returnFocus={() => {
            if (trigger.current?.isConnected && !trigger.current.matches(':disabled'))
              trigger.current.focus()
            else heading.current?.focus()
          }}
        />
      )}
    </div>
  )
}
export function DecisionDialog({
  detail,
  kind,
  pending,
  error,
  stale,
  onClose,
  refresh,
  confirm,
  returnFocus,
}: {
  detail: Detail
  kind: 'approve' | 'reject'
  pending: boolean
  error: unknown
  stale: boolean
  onClose: () => void
  refresh: () => void
  confirm: (reason: string) => Promise<void>
  returnFocus: () => void
}) {
  const [reason, setReason] = useState('')
  const valid = kind === 'approve' || (reason.trim().length > 0 && reason.trim().length <= 1000)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto"
        aria-busy={pending}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          returnFocus()
        }}
        onEscapeKeyDown={(e) => {
          if (pending) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (pending) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {kind === 'approve' ? 'Javaslat jóváhagyása' : 'Javaslat elutasítása'}
          </DialogTitle>
          <DialogDescription>
            {detail.foodItem?.name ?? 'Törölt élelmiszer'} · {date(detail.submittedAt)}
          </DialogDescription>
        </DialogHeader>
        {kind === 'approve' ? (
          <>
            <p>A jóváhagyás módosítja az élelmiszer tápértékeit. A művelet auditnaplóba kerül.</p>
            <Comparison original={detail.originalNutrition} proposed={detail.proposedNutrition} />
          </>
        ) : (
          <div className="space-y-3">
            <Label htmlFor="rejection-reason">Elutasítás indoka (kötelező)</Label>
            <Textarea
              id="rejection-reason"
              value={reason}
              disabled={pending}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
            />
            <p>{reason.trim().length} / 1000 karakter</p>
          </div>
        )}
        {stale && (
          <div role="alert" className="space-y-3">
            <p>
              A korábbi megerősítés már nem érvényes. Frissítsd az adatokat, majd vizsgáld meg újra
              a javaslatot.
            </p>
            <Button variant="outline" disabled={pending} onClick={refresh}>
              Frissítés és új ellenőrzés
            </Button>
          </div>
        )}
        {error != null && <ErrorPanel error={error} />}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Mégse
          </Button>
          <Button
            variant={kind === 'reject' ? 'destructive' : 'primary'}
            disabled={pending || stale || !valid}
            onClick={() => {
              if (!pending && !stale && valid) void confirm(reason.trim())
            }}
          >
            {pending
              ? 'Feldolgozás…'
              : kind === 'approve'
                ? 'Jóváhagyás megerősítése'
                : 'Elutasítás megerősítése'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
