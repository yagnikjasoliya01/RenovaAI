import { useEffect, useState } from 'react'
import { estimateProject } from '../api'
import { useStore } from '../store/useStore'
import type { Estimate } from '../types'
import { isOpening, LABEL_TEXT } from '../utils/regionUtils'

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

export default function CostPanel() {
  const activeId = useStore((s) => s.activeId)
  const regions = useStore((s) => s.regions)
  const scaleFt = useStore((s) => s.scaleFt)
  const scalePx = useStore((s) => s.scalePx)

  const [est, setEst] = useState<Estimate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const hasScale = !!scaleFt && !!scalePx
  const canEstimate = !!activeId && hasScale && regions.length > 0

  useEffect(() => {
    if (!canEstimate) {
      setEst(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const data = await estimateProject(activeId, {
          scale_ft: scaleFt,
          scale_px: scalePx,
          regions: regions.map((r) => ({
            label: r.label,
            points: r.points,
            material_id: r.material_id ?? null,
          })),
        })
        if (!cancelled) {
          setEst(data)
          setError('')
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Failed to load estimate',
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [activeId, canEstimate, regions, scaleFt, scalePx, refreshKey])

  const hasMaterial = (est?.regions ?? []).some((r) => r.material_id)

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
        <h2 className="text-sm font-semibold text-zinc-100">Cost estimate</h2>
        <div className="flex items-center gap-2">
          {hasScale && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {scaleFt} ft / {scalePx!.toFixed(0)} px
            </span>
          )}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Refresh estimate"
            disabled={!canEstimate}
            className="text-zinc-500 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↻
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {!activeId && (
          <p className="text-center text-sm text-zinc-500">
            Open a project to see a cost breakdown
          </p>
        )}

        {activeId && !hasScale && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-center">
            <p className="text-sm text-zinc-300">
              Set a reference measurement first
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Use the <span className="font-medium text-zinc-300">Measure</span>{' '}
              tool (↔) on the canvas, then click two points of a known length
              and enter the distance in feet.
            </p>
          </div>
        )}

        {activeId && hasScale && regions.length === 0 && (
          <p className="text-center text-sm text-zinc-500">
            No regions yet. Draw walls and apply materials to build the
            estimate.
          </p>
        )}

        {loading && !est && (
          <p className="text-center text-sm text-zinc-500">Estimating…</p>
        )}

        {error && !est && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-xs text-red-400">
            {error}
          </p>
        )}

        {est && (
          <>
            {est.regions.map((r, i) => {
              const opening = isOpening(r.label)
              const hasCost = r.material_cost > 0 || r.labor_cost > 0
              return (
                <div
                  key={i}
                  className={`rounded-xl border px-3 py-2 ${
                    opening
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-zinc-800 bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-zinc-100">
                      {LABEL_TEXT[r.label as keyof typeof LABEL_TEXT] ?? r.label}
                    </span>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        opening ? 'text-emerald-400' : 'text-zinc-100'
                      }`}
                    >
                      {inr(r.total_cost)}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    {opening
                      ? 'Opening — subtracted from the surface around it'
                      : r.material_name
                        ? `${r.material_name} · ${r.area_sqft.toFixed(1)} sq ft`
                        : `No material · ${r.area_sqft.toFixed(1)} sq ft`}
                  </div>
                  {hasCost && (
                    <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-zinc-500">
                      <span>
                        Material {inr(r.material_cost)} · Labor{' '}
                        {inr(r.labor_cost)}
                      </span>
                      <span>
                        {r.quantity} {r.unit}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Material</span>
                <span className="tabular-nums">{inr(est.totals.material)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm text-zinc-400">
                <span>Labor</span>
                <span className="tabular-nums">{inr(est.totals.labor)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-zinc-800 pt-2 text-base font-semibold text-zinc-100">
                <span>Grand total</span>
                <span className="tabular-nums">
                  {inr(est.totals.grand_total)}
                </span>
              </div>
            </div>

            {!hasMaterial && (
              <p className="px-1 pt-1 text-center text-xs text-zinc-600">
                Apply materials to walls to get itemized pricing.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
