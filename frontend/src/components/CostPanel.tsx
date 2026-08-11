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
      <header 
        className="flex h-10 shrink-0 items-center justify-between px-3"
        style={{ borderBottom: '1px solid #1a1a1a' }}
      >
        <h2 
          className="text-sm font-semibold"
          style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
        >
          Cost estimate
        </h2>
        <div className="flex items-center gap-2">
          {hasScale && (
            <span 
              className="flex items-center gap-1.5 text-xs"
              style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
            >
              <span 
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: '#fbbf24' }}
              />
              {scaleFt} ft / {scalePx!.toFixed(0)} px
            </span>
          )}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Refresh estimate"
            disabled={!canEstimate}
            className="flex h-8 w-8 items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ color: '#6a6a6a' }}
            onMouseEnter={(e) => {
              if (canEstimate) e.currentTarget.style.color = '#ffffff'
            }}
            onMouseLeave={(e) => {
              if (canEstimate) e.currentTarget.style.color = '#6a6a6a'
            }}
          >
            ↻
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {!activeId && (
          <p 
            className="text-center text-sm"
            style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
          >
            Open a project to see a cost breakdown
          </p>
        )}

        {activeId && !hasScale && (
          <div 
            className="p-3 text-center"
            style={{
              borderRadius: '12px',
              border: '1px solid #1a1a1a',
              backgroundColor: '#0f0f0f'
            }}
          >
            <p 
              className="text-sm"
              style={{ color: '#a1a1a1', fontFamily: 'Geist, Inter, sans-serif' }}
            >
              Set a reference measurement first
            </p>
            <p 
              className="mt-1 text-xs leading-relaxed"
              style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
            >
              Use the <span style={{ fontWeight: 500, color: '#a1a1a1' }}>Measure</span>{' '}
              tool (↔) on the canvas, then click two points of a known length
              and enter the distance in feet.
            </p>
          </div>
        )}

        {activeId && hasScale && regions.length === 0 && (
          <p 
            className="text-center text-sm"
            style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
          >
            No regions yet. Draw walls and apply materials to build the
            estimate.
          </p>
        )}

        {loading && !est && (
          <p 
            className="text-center text-sm"
            style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
          >
            Estimating…
          </p>
        )}

        {error && !est && (
          <p 
            className="p-3 text-center text-xs"
            style={{
              borderRadius: '10px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ff6b6b',
              fontFamily: 'Geist, Inter, sans-serif'
            }}
          >
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
                  className="px-3 py-2"
                  style={{
                    borderRadius: '12px',
                    border: opening ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #1a1a1a',
                    backgroundColor: opening ? 'rgba(16, 185, 129, 0.05)' : '#0f0f0f'
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span 
                      className="min-w-0 truncate text-sm font-medium"
                      style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
                    >
                      {LABEL_TEXT[r.label as keyof typeof LABEL_TEXT] ?? r.label}
                    </span>
                    <span
                      className="shrink-0 text-sm font-semibold tabular-nums"
                      style={{ 
                        color: opening ? '#10b981' : '#ffffff',
                        fontFamily: 'Geist, Inter, sans-serif'
                      }}
                    >
                      {inr(r.total_cost)}
                    </span>
                  </div>
                  <div 
                    className="mt-0.5 truncate text-xs"
                    style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
                  >
                    {opening
                      ? 'Opening — subtracted from the surface around it'
                      : r.material_name
                        ? `${r.material_name} · ${r.area_sqft.toFixed(1)} sq ft`
                        : `No material · ${r.area_sqft.toFixed(1)} sq ft`}
                  </div>
                  {hasCost && (
                    <div 
                      className="mt-1 flex items-center justify-between text-[11px] tabular-nums"
                      style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
                    >
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

            <div 
              className="px-3 py-2.5"
              style={{
                borderRadius: '12px',
                border: '1px solid #1a1a1a',
                backgroundColor: '#0f0f0f'
              }}
            >
              <div 
                className="flex items-center justify-between text-sm"
                style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                <span>Material</span>
                <span className="tabular-nums">{inr(est.totals.material)}</span>
              </div>
              <div 
                className="mt-1 flex items-center justify-between text-sm"
                style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                <span>Labor</span>
                <span className="tabular-nums">{inr(est.totals.labor)}</span>
              </div>
              <div 
                className="mt-2 flex items-center justify-between pt-2 text-base font-semibold"
                style={{ 
                  borderTop: '1px solid #1a1a1a',
                  color: '#ffffff',
                  fontFamily: 'Geist, Inter, sans-serif'
                }}
              >
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
