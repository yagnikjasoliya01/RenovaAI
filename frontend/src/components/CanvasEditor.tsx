import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react'
import { saveProject, type SaveProjectBody } from '../api'
import { imageUrl } from '../api/client'
import { useStore } from '../store/useStore'
import type { Material, Region, RegionLabel } from '../types'
import MeasureModal from './MeasureModal'
import {
  areaSqftEffective,
  centroid,
  distance,
  findCutouts,
  isOpening,
  LABEL_TEXT,
  LABELS,
  pointInPolygon,
  REGION_COLORS,
} from '../utils/regionUtils'
import { detectEdges, snapToEdge, type EdgeMap } from '../utils/edgeDetection'

type Mode = 'select' | 'draw' | 'measure' | 'pan'

interface View {
  scale: number
  x: number
  y: number
}

interface DrawState {
  points: [number, number][]
  hover: [number, number] | null
}

interface MeasureState {
  a: [number, number] | null
  b: [number, number] | null
  hover: [number, number] | null
}

type DragState =
  | { kind: 'vertex'; regionId: number; pointIdx: number }
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | null

const FIT_PADDING = 32
const HANDLE_RADIUS = 6

const HELP_TEXT: Record<Mode, string> = {
  select: 'Click a region to edit it · drag white dots to reshape · Del to delete',
  draw: 'Click to place points (auto-snaps to edges) · click the first point or right-click to finish · Ctrl+Z removes the last point · Esc cancels',
  measure: 'Click two points of a known length, then type the measurement in feet',
  pan: 'Drag to move the view · scroll or use + / − to zoom',
}

export default function CanvasEditor({
  expanded = false,
  regionsOpen = false,
  onToggleRegions,
}: {
  expanded?: boolean
  regionsOpen?: boolean
  onToggleRegions?: () => void
}) {
  const activeId = useStore((s) => s.activeId)
  const originalImage = useStore((s) => s.originalImage)
  const regions = useStore((s) => s.regions)
  const materials = useStore((s) => s.materials)
  const scaleFt = useStore((s) => s.scaleFt)
  const scalePx = useStore((s) => s.scalePx)
  const textureScale = useStore((s) => s.textureScale)
  const setTextureScale = useStore((s) => s.setTextureScale)
  const addRegion = useStore((s) => s.addRegion)
  const updateRegion = useStore((s) => s.updateRegion)
  const updateRegionNoHistory = useStore((s) => s.updateRegionNoHistory)
  const removeRegion = useStore((s) => s.removeRegion)
  const setScale = useStore((s) => s.setScale)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const beginEdit = useStore((s) => s.beginEdit)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const textureCache = useRef<Map<string, HTMLImageElement>>(new Map())
  const patternCache = useRef<Map<string, CanvasPattern | null>>(new Map())

  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const [mode, setMode] = useState<Mode>('select')
  const [drawLabel, setDrawLabel] = useState<RegionLabel>('wall')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeMaterial, setActiveMaterial] = useState<string | null>(null)
  const [drawCount, setDrawCount] = useState(0)
  const [showGuide, setShowGuide] = useState(() => {
    // Only show guide if user hasn't seen it before
    const hasSeenGuide = localStorage.getItem('renovaai_guide_seen')
    return !hasSeenGuide
  })
  const [measurePrompt, setMeasurePrompt] = useState<{ distPx: number } | null>(
    null,
  )
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  )
  const savingRef = useRef(false)
  const pendingSaveRef = useRef<SaveProjectBody | null>(null)

  const drawRef = useRef<DrawState>({ points: [], hover: null })
  const measureRef = useRef<MeasureState>({ a: null, b: null, hover: null })
  const dragRef = useRef<DragState>(null)
  const spaceRef = useRef(false)
  const edgeMapRef = useRef<EdgeMap | null>(null)

  const stateRef = useRef({
    view,
    mode,
    regions,
    selectedId,
    imgSize,
    scaleFt,
    scalePx,
    drawCount,
  })
  stateRef.current = {
    view,
    mode,
    regions,
    selectedId,
    imgSize,
    scaleFt,
    scalePx,
    drawCount,
  }

  useEffect(() => {
    if (!originalImage) return
    const img = new Image()
    img.crossOrigin = 'anonymous' // Enable CORS for Supabase Storage
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
      
      // Generate edge map for smart snap (always enabled)
      try {
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = img.naturalWidth
        tempCanvas.height = img.naturalHeight
        const tempCtx = tempCanvas.getContext('2d')
        if (tempCtx) {
          tempCtx.drawImage(img, 0, 0)
          const imageData = tempCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight)
          edgeMapRef.current = detectEdges(imageData)
        }
      } catch (error) {
        console.warn('Edge detection failed:', error)
        edgeMapRef.current = null
      }
    }
    img.onerror = () => {
      console.error('Failed to load image:', imageUrl(originalImage))
      setImgSize({ w: 0, h: 0 })
    }
    img.src = imageUrl(originalImage)
    imgRef.current = img
  }, [originalImage])

  const fitView = useCallback(() => {
    const el = containerRef.current
    const size = imgRef.current && stateRef.current.imgSize
    if (!el || !size) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    const scale = Math.min(
      (cw - FIT_PADDING * 2) / size.w,
      (ch - FIT_PADDING * 2) / size.h,
    )
    setView({
      scale,
      x: (cw - size.w * scale) / 2,
      y: (ch - size.h * scale) / 2,
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => fitView())
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitView])

  useEffect(() => {
    if (imgSize) fitView()
  }, [imgSize, fitView])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { view: v, regions: rs, selectedId: sel, imgSize: size } = stateRef.current
    const dpr = window.devicePixelRatio || 1
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr
      canvas.height = ch * dpr
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (size && imgRef.current) {
      ctx.save()
      ctx.translate(v.x, v.y)
      ctx.scale(v.scale, v.scale)
      ctx.drawImage(imgRef.current, 0, 0)
      ctx.restore()
    }

    const toScreen = (pt: [number, number]): [number, number] => [
      pt[0] * v.scale + v.x,
      pt[1] * v.scale + v.y,
    ]

    const tracePoly = (poly: [number, number][]) => {
      poly.forEach(([px, py], i) =>
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py),
      )
      ctx.closePath()
    }

    const getPattern = (
      tex: HTMLImageElement,
      materialId: string,
      scale: number,
    ): CanvasPattern | null => {
      const key = `${materialId}:${scale}`
      if (patternCache.current.has(key)) {
        return patternCache.current.get(key) ?? null
      }
      let source: HTMLImageElement | HTMLCanvasElement = tex
      if (Math.abs(scale - 1) >= 0.02) {
        const off = document.createElement('canvas')
        off.width = Math.max(2, Math.round(tex.naturalWidth * scale))
        off.height = Math.max(2, Math.round(tex.naturalHeight * scale))
        const octx = off.getContext('2d')
        if (!octx) return null
        octx.imageSmoothingEnabled = true
        octx.imageSmoothingQuality = 'high'
        octx.drawImage(tex, 0, 0, off.width, off.height)
        source = off
      }
      const pattern = ctx.createPattern(source, 'repeat')
      patternCache.current.set(key, pattern)
      return pattern
    }

    for (const r of rs) {
      const mat = r.material_id
        ? materials.find((m) => m.id === r.material_id)
        : null
      const color = mat?.color ?? REGION_COLORS[r.label as RegionLabel] ?? '#ffffff'
      const cutouts = findCutouts(r, rs)
      ctx.save()
      ctx.translate(v.x, v.y)
      ctx.scale(v.scale, v.scale)
      ctx.beginPath()
      tracePoly(r.points)
      for (const c of cutouts) tracePoly(c.points)
      ctx.fillStyle = `${color}59`
      ctx.fill('evenodd')

      if (mat) {
        const tex = mat.texture ? textureCache.current.get(mat.id) : null
        if (tex && tex.complete && tex.naturalWidth > 0 && size) {
          ctx.save()
          ctx.beginPath()
          tracePoly(r.points)
          for (const c of cutouts) tracePoly(c.points)
          ctx.clip('evenodd')
          const pattern = getPattern(tex, mat.id, textureScale)
          if (pattern) {
            ctx.globalAlpha = 1
            ctx.fillStyle = pattern
            ctx.fillRect(0, 0, size.w, size.h)
          }
          ctx.restore()
        }
      }

      ctx.beginPath()
      tracePoly(r.points)
      ctx.lineWidth = 2 / v.scale
      ctx.strokeStyle = sel === r.id ? '#ffffff' : color
      ctx.setLineDash(sel === r.id ? [] : [6 / v.scale, 5 / v.scale])
      ctx.stroke()
      ctx.setLineDash([])

      const [cx, cy] = centroid(r.points)
      ctx.font = `600 ${13 / v.scale}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 3 / v.scale
      ctx.strokeStyle = 'rgba(9,9,11,0.8)'
      ctx.strokeText(r.label, cx, cy)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(r.label, cx, cy)
      ctx.restore()

      if (sel === r.id) {
        for (const [px, py] of r.points) {
          const [sx, sy] = toScreen([px, py])
          ctx.beginPath()
          ctx.arc(sx, sy, HANDLE_RADIUS, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = color
          ctx.stroke()
        }
      }
    }

    const d = drawRef.current
    if (d.points.length > 0) {
      ctx.save()
      ctx.translate(v.x, v.y)
      ctx.scale(v.scale, v.scale)
      ctx.beginPath()
      d.points.forEach(([px, py], i) =>
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py),
      )
      if (d.hover) ctx.lineTo(d.hover[0], d.hover[1])
      ctx.lineWidth = 2 / v.scale
      ctx.strokeStyle = REGION_COLORS[drawLabel]
      ctx.setLineDash([8 / v.scale, 6 / v.scale])
      ctx.stroke()
      ctx.setLineDash([])
      for (const [px, py] of d.points) {
        ctx.beginPath()
        ctx.arc(px, py, 4 / v.scale, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      }
      
      // Draw snap radius indicator when hovering (subtle)
      if (d.hover && edgeMapRef.current) {
        ctx.beginPath()
        ctx.arc(d.hover[0], d.hover[1], 10 / v.scale, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)'
        ctx.lineWidth = 1 / v.scale
        ctx.stroke()
      }
      
      ctx.restore()
    }

    const m = measureRef.current
    const mpt = m.b ?? m.hover
    if (m.a && mpt) {
      ctx.save()
      ctx.translate(v.x, v.y)
      ctx.scale(v.scale, v.scale)
      ctx.beginPath()
      ctx.moveTo(m.a[0], m.a[1])
      ctx.lineTo(mpt[0], mpt[1])
      ctx.lineWidth = 2 / v.scale
      ctx.strokeStyle = '#f59e0b'
      ctx.setLineDash([8 / v.scale, 6 / v.scale])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
      
      const [sx, sy] = toScreen(m.a)
      const [ex, ey] = toScreen(mpt)
      ctx.beginPath()
      ctx.arc(sx, sy, HANDLE_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#f59e0b'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ex, ey, HANDLE_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#f59e0b'
      ctx.fill()
    }
  }, [drawLabel, materials, textureScale])

  useEffect(() => {
    for (const m of materials) {
      if (!m.texture || textureCache.current.has(m.id)) continue
      const retry = (attempt: number) => {
        const img = new Image()
        img.crossOrigin = 'anonymous' // Enable CORS for external images
        img.onload = () => draw()
        img.onerror = () => {
          textureCache.current.delete(m.id)
          if (attempt < 3) setTimeout(() => retry(attempt + 1), 2000)
        }
        img.src = imageUrl(`/materials/textures/${m.texture}`)
        textureCache.current.set(m.id, img)
      }
      retry(0)
    }
  }, [materials, draw])

  useEffect(() => {
    draw()
  }, [
    draw,
    view,
    regions,
    selectedId,
    imgSize,
    mode,
    scaleFt,
    scalePx,
    textureScale,
  ])

  function screenToImage(sx: number, sy: number): [number, number] {
    const { view: v } = stateRef.current
    return [(sx - v.x) / v.scale, (sy - v.y) / v.scale]
  }

  function clampToImage(pt: [number, number]): [number, number] {
    const size = stateRef.current.imgSize
    const maxX = size ? size.w : Number.POSITIVE_INFINITY
    const maxY = size ? size.h : Number.POSITIVE_INFINITY
    return [
      Math.min(Math.max(0, pt[0]), maxX),
      Math.min(Math.max(0, pt[1]), maxY),
    ]
  }

  function hitTest(sx: number, sy: number): number | null {
    const { regions: rs, selectedId: sel, view: v } = stateRef.current
    if (sel !== null) {
      const r = rs.find((x) => x.id === sel)
      if (r) {
        for (let i = 0; i < r.points.length; i++) {
          const [x, y] = r.points[i]
          if (
            distance([sx, sy], [x * v.scale + v.x, y * v.scale + v.y]) <=
            HANDLE_RADIUS + 3
          ) {
            return sel
          }
        }
      }
    }
    const img = screenToImage(sx, sy)
    for (let i = rs.length - 1; i >= 0; i--) {
      if (pointInPolygon(img, rs[i].points)) return rs[i].id ?? null
    }
    return null
  }

  function findVertex(
    sx: number,
    sy: number,
  ): { regionId: number; pointIdx: number } | null {
    const { regions: rs, view: v } = stateRef.current
    for (let i = rs.length - 1; i >= 0; i--) {
      for (let j = 0; j < rs[i].points.length; j++) {
        const [x, y] = rs[i].points[j]
        if (
          distance([sx, sy], [x * v.scale + v.x, y * v.scale + v.y]) <=
          HANDLE_RADIUS + 3
        ) {
          return { regionId: rs[i].id ?? -1, pointIdx: j }
        }
      }
    }
    return null
  }

  const closeGuide = useCallback(() => {
    setShowGuide(false)
    localStorage.setItem('renovaai_guide_seen', 'true')
  }, [])

  const addDrawPoint = useCallback((pt: [number, number]) => {
    // Apply smart snap if edge map is available
    let snappedPt = pt
    if (edgeMapRef.current) {
      snappedPt = snapToEdge(pt, edgeMapRef.current, 10)
    }
    
    drawRef.current.points = [...drawRef.current.points, snappedPt]
    setDrawCount(drawRef.current.points.length)
    closeGuide()
  }, [closeGuide])

  const removeLastDrawPoint = useCallback(() => {
    const pts = drawRef.current.points
    if (pts.length === 0) return
    drawRef.current.points = pts.slice(0, -1)
    setDrawCount(drawRef.current.points.length)
    draw()
  }, [draw])

  const cancelDraw = useCallback(() => {
    drawRef.current = { points: [], hover: null }
    setDrawCount(0)
    draw()
  }, [draw])

  function finishDraw() {
    const pts = drawRef.current.points
    if (pts.length >= 3) {
      const id = addRegion({
        label: drawLabel,
        points: [...pts],
        material_id: activeMaterial,
      })
      setSelectedId(id)
    }
    drawRef.current = { points: [], hover: null }
    setDrawCount(0)
    draw()
  }

  function beginMeasure(pt: [number, number]) {
    const ms = measureRef.current
    if (!ms.a) {
      ms.a = pt
      return
    }
    const px = distance(ms.a, pt)
    ms.a = null
    ms.b = null
    if (px > 0) setMeasurePrompt({ distPx: px })
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { mode: m, view: v } = stateRef.current

    if (m === 'pan' || spaceRef.current || e.button === 1) {
      dragRef.current = { kind: 'pan', sx, sy, vx: v.x, vy: v.y }
      canvas.setPointerCapture(e.pointerId)
      return
    }

    if (e.button !== 0) return

    if (m === 'draw') {
      const img = clampToImage(screenToImage(sx, sy))
      const pts = drawRef.current.points
      if (
        pts.length >= 3 &&
        distance(pts[0], img) <= (HANDLE_RADIUS + 3) / v.scale
      ) {
        finishDraw()
      } else {
        addDrawPoint(img)
      }
      draw()
      return
    }

    if (m === 'measure') {
      beginMeasure(clampToImage(screenToImage(sx, sy)))
      draw()
      return
    }

    const vertex = findVertex(sx, sy)
    if (vertex) {
      setSelectedId(vertex.regionId)
      beginEdit()
      dragRef.current = { kind: 'vertex', ...vertex }
      canvas.setPointerCapture(e.pointerId)
      return
    }
    const hit = hitTest(sx, sy)
    setSelectedId(hit)
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { mode: m } = stateRef.current

    const drag = dragRef.current
    if (drag?.kind === 'pan') {
      setView({
        ...stateRef.current.view,
        x: drag.vx + (sx - drag.sx),
        y: drag.vy + (sy - drag.sy),
      })
      return
    }
    if (drag?.kind === 'vertex') {
      let img = clampToImage(screenToImage(sx, sy))
      
      // Apply smart snap
      if (edgeMapRef.current) {
        img = snapToEdge(img, edgeMapRef.current, 10)
      }
      
      const r = stateRef.current.regions.find((x) => x.id === drag.regionId)
      if (r) {
        const pts = [...r.points]
        pts[drag.pointIdx] = img
        updateRegionNoHistory(drag.regionId, { points: pts })
      }
      return
    }

    let img = clampToImage(screenToImage(sx, sy))
    if (m === 'draw') {
      // Apply smart snap to hover preview
      if (edgeMapRef.current) {
        img = snapToEdge(img, edgeMapRef.current, 10)
      }
      drawRef.current.hover = img
      draw()
    } else if (m === 'measure') {
      measureRef.current.hover = img
      draw()
    }
  }

  function onPointerUp() {
    dragRef.current = null
  }

  function onWheel(e: WheelEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const v = stateRef.current.view
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    const scale = Math.min(40, Math.max(0.05, v.scale * factor))
    setView({
      scale,
      x: sx - ((sx - v.x) * scale) / v.scale,
      y: sy - ((sy - v.y) * scale) / v.scale,
    })
  }

  function onContextMenu(e: ReactMouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const { mode: m } = stateRef.current
    if (m === 'draw') finishDraw()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA'
      const st = stateRef.current

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (inInput) return
        e.preventDefault()
        if (st.mode === 'draw' && st.drawCount > 0) removeLastDrawPoint()
        else if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (inInput) return
        e.preventDefault()
        redo()
        return
      }
      if (e.code === 'Space') spaceRef.current = true
      if (e.key === 'Backspace') {
        if (inInput || tag === 'SELECT') return
        if (st.mode === 'draw' && st.drawCount > 0) {
          e.preventDefault()
          removeLastDrawPoint()
          return
        }
      }
      if (e.key === 'Delete') {
        if (inInput || tag === 'SELECT') return
        const { selectedId: sel, mode: m } = stateRef.current
        if (sel !== null && m === 'select') {
          removeRegion(sel)
          setSelectedId(null)
        }
      }
      if (e.key === 'Escape') {
        if (st.mode === 'draw' && st.drawCount > 0) {
          cancelDraw()
          return
        }
        drawRef.current = { points: [], hover: null }
        measureRef.current = { a: null, b: null, hover: null }
        setSelectedId(null)
        draw()
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') spaceRef.current = false
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [undo, redo, removeRegion, draw, removeLastDrawPoint, cancelDraw])

  const selectedRegion = regions.find((r) => r.id === selectedId) ?? null
  const selectedMaterial = selectedRegion?.material_id
    ? materials.find((m) => m.id === selectedRegion.material_id) ?? null
    : null
  const paletteActive = selectedRegion
    ? isOpening(selectedRegion.label)
      ? null
      : selectedRegion.material_id
    : activeMaterial
  const brushMaterial = activeMaterial
    ? materials.find((m) => m.id === activeMaterial) ?? null
    : null

  const runSave = useCallback(
    async (id: number, body: SaveProjectBody) => {
      if (savingRef.current) {
        pendingSaveRef.current = body
        return
      }
      savingRef.current = true
      setSaveStatus('saving')
      try {
        await saveProject(id, body)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      } finally {
        savingRef.current = false
        const next = pendingSaveRef.current
        pendingSaveRef.current = null
        if (next) runSave(id, next)
      }
    },
    [],
  )

  useEffect(() => {
    if (!activeId || !imgSize) return
    setSaveStatus('saving')
    const t = setTimeout(async () => {
      await runSave(activeId, {
        scale_ft: scaleFt,
        scale_px: scalePx,
        reference_note: null,
        texture_scale: textureScale,
        regions: regions.map((r) => ({
          label: r.label,
          points: r.points,
          material_id: r.material_id ?? null,
        })),
      })
    }, 800)
    return () => clearTimeout(t)
  }, [activeId, regions, scaleFt, scalePx, imgSize, textureScale, runSave])

  async function saveNow() {
    if (!activeId) return
    await runSave(activeId, {
      scale_ft: scaleFt,
      scale_px: scalePx,
      reference_note: null,
      texture_scale: textureScale,
      regions: regions.map((r) => ({
        label: r.label,
        points: r.points,
        material_id: r.material_id ?? null,
      })),
    })
  }

  function pickMaterial(mid: string | null) {
    if (selectedRegion) {
      if (isOpening(selectedRegion.label)) return
      updateRegion(selectedRegion.id ?? -1, { material_id: mid })
    } else {
      setActiveMaterial(mid)
    }
  }

  function zoomAt(factor: number) {
    const el = containerRef.current
    const v = stateRef.current.view
    if (!el) {
      setView((old) => ({
        ...old,
        scale: Math.min(40, Math.max(0.05, old.scale * factor)),
      }))
      return
    }
    const sx = el.clientWidth / 2
    const sy = el.clientHeight / 2
    const scale = Math.min(40, Math.max(0.05, v.scale * factor))
    setView({
      scale,
      x: sx - ((sx - v.x) * scale) / v.scale,
      y: sy - ((sy - v.y) * scale) / v.scale,
    })
  }

  function chooseTool(m: Mode) {
    if (mode === m) {
      if (m === 'draw') cancelDraw()
      if (m === 'measure') {
        measureRef.current = { a: null, b: null, hover: null }
        draw()
      }
      setMode('select')
    } else {
      setMode(m)
    }
  }

  const toolBtn = (label: string, m: Mode, icon: string) => (
    <button
      onClick={() => chooseTool(m)}
      title={HELP_TEXT[m]}
      className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition ${
        mode === m
          ? 'bg-zinc-100 font-medium text-zinc-950'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
      }`}
    >
      <span className="text-[13px] leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  )

  const regionListItem = (r: Region) => {
    const color = REGION_COLORS[r.label as RegionLabel] ?? '#fff'
    const mat = r.material_id
      ? materials.find((m) => m.id === r.material_id)
      : null
    return (
      <button
        key={r.id}
        onClick={() =>
          setSelectedId(r.id === selectedId ? null : (r.id ?? null))
        }
        className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-left text-xs transition ${
          r.id === selectedId
            ? 'bg-zinc-100 text-zinc-950'
            : 'text-zinc-300 hover:bg-zinc-800'
        }`}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="min-w-0 flex-1 truncate">
          {LABEL_TEXT[r.label as RegionLabel] ?? r.label}
          {mat ? ` · ${mat.name}` : ''}
        </span>
      </button>
    )
  }

  const selectedCutouts = selectedRegion
    ? findCutouts(selectedRegion, regions).map((c) => c.points)
    : []

  const inspectorBody = (
    <div className="mt-2 space-y-2">
      <div>
        <label className="text-xs font-medium text-zinc-500">Label</label>
        <select
          value={selectedRegion?.label}
          onChange={(e) =>
            selectedRegion &&
            updateRegion(selectedRegion.id ?? -1, {
              label: e.target.value as RegionLabel,
            })
          }
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-zinc-500"
        >
          {LABELS.map((l) => (
            <option key={l} value={l}>
              {LABEL_TEXT[l]}
            </option>
          ))}
        </select>
      </div>
      {isOpening(selectedRegion?.label) ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-xs leading-relaxed text-zinc-400">
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
          <span>
            Opening — no material needed. This area is subtracted from the
            surface around it.
          </span>
        </div>
      ) : (
        <div>
          <label className="text-xs font-medium text-zinc-500">Material</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 p-1">
            {selectedMaterial ? (
              <>
                <img
                  src={imageUrl(`/materials/thumbs/${selectedMaterial.thumbnail}`)}
                  alt={selectedMaterial.name}
                  className="h-7 w-10 rounded object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-100">
                  {selectedMaterial.name}
                </span>
                <button
                  onClick={() =>
                    selectedRegion &&
                    updateRegion(selectedRegion.id ?? -1, {
                      material_id: null,
                    })
                  }
                  title="Remove material"
                  className="text-zinc-500 hover:text-zinc-200"
                >
                  ✕
                </button>
              </>
            ) : (
              <span className="text-xs text-zinc-500">
                Pick from palette below
              </span>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Area</span>
        <span className="font-medium text-zinc-100">
          {selectedRegion &&
          areaSqftEffective(
            selectedRegion.points,
            selectedCutouts,
            scaleFt,
            scalePx,
          ) === null
            ? 'Set a reference'
            : selectedRegion
              ? `${areaSqftEffective(
                  selectedRegion.points,
                  selectedCutouts,
                  scaleFt,
                  scalePx,
                )?.toFixed(1)} sq ft`
              : ''}
        </span>
      </div>
      <button
        onClick={() => {
          if (!selectedRegion) return
          removeRegion(selectedRegion.id ?? -1)
          setSelectedId(null)
        }}
        className="w-full rounded-lg border border-red-500/40 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
      >
        Delete region
      </button>
    </div>
  )

  const materialTile = (m: Material) => (
    <button
      key={m.id}
      onClick={() => pickMaterial(m.id)}
      title={m.name}
      className={`flex w-16 shrink-0 flex-col items-center gap-1 rounded-lg p-1 transition ${
        paletteActive === m.id
          ? 'bg-zinc-100 text-zinc-950 ring-2 ring-zinc-100'
          : 'text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      <img
        src={imageUrl(`/materials/thumbs/${m.thumbnail}`)}
        alt={m.name}
        className="h-10 w-14 rounded object-cover"
      />
      <span className="w-full truncate text-center text-[10px] leading-tight">
        {m.name}
      </span>
    </button>
  )

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/60 px-3">
        <div className="flex min-w-0 items-center gap-1">
          <button
            onClick={() => undo()}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="flex h-8 w-9 shrink-0 items-center justify-center rounded-lg text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ⟲
          </button>
          <button
            onClick={() => redo()}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="flex h-8 w-9 shrink-0 items-center justify-center rounded-lg text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ⟳
          </button>
          <span className="mx-1 h-5 w-px shrink-0 bg-zinc-800" />
          {toolBtn('Select', 'select', '▭')}
          {toolBtn('Draw', 'draw', '✎')}
          {toolBtn('Measure', 'measure', '↔')}
          {toolBtn('Pan', 'pan', '✋')}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === 'draw' && (
            <select
              value={drawLabel}
              onChange={(e) => setDrawLabel(e.target.value as RegionLabel)}
              className="h-8 rounded-lg border border-zinc-700 bg-zinc-800 px-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              {LABELS.map((l) => (
                <option key={l} value={l}>
                  {LABEL_TEXT[l]}
                </option>
              ))}
            </select>
          )}
          {regions.length > 0 && (
            <button
              onClick={onToggleRegions}
              title="Toggle region list"
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition ${
                regionsOpen
                  ? 'bg-zinc-100 font-medium text-zinc-950'
                  : 'border border-zinc-700 text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: REGION_COLORS[regions[0]?.label as RegionLabel] ?? '#fff' }}
              />
              Regions ({regions.length})
            </button>
          )}
          <button
            onClick={saveNow}
            className="flex h-8 items-center rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-300"
          >
            Save
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-zinc-950">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          style={{
            cursor:
              mode === 'pan'
                ? 'grab'
                : mode === 'select'
                  ? 'default'
                  : 'crosshair',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          onContextMenu={onContextMenu}
        />

        <label
          className="absolute left-1/2 top-3 z-20 flex h-7 -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-900/90 px-2.5 text-[11px] text-zinc-300 shadow-lg backdrop-blur"
          title="Material pattern size — smaller repeats more, bigger repeats less"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Texture
          </span>
          <input
            type="range"
            min="0.2"
            max="5"
            step="0.05"
            value={textureScale}
            onChange={(e) => setTextureScale(parseFloat(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-zinc-100"
          />
          <span className="w-7 text-right tabular-nums text-zinc-400">
            {Math.round(textureScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setTextureScale(1)}
            title="Reset texture scale"
            className="rounded px-0.5 text-zinc-500 hover:text-zinc-200"
          >
            ↺
          </button>
        </label>

        {showGuide && regions.length === 0 && drawCount === 0 && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="pointer-events-auto mx-4 max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Get started
                </h3>
                <button
                  onClick={closeGuide}
                  className="text-zinc-500 hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-sm text-zinc-300">
                <li>
                  <span className="font-semibold text-zinc-100">1 · Draw.</span>{' '}
                  Use the Draw tool to trace walls, windows, balconies…
                </li>
                <li>
                  <span className="font-semibold text-zinc-100">2 · Measure.</span>{' '}
                  Set one known length for real-world sizes.
                </li>
                <li>
                  <span className="font-semibold text-zinc-100">
                    3 · Materials.
                  </span>{' '}
                  Click a thumbnail below to apply a finish.
                </li>
              </ol>
              <button
                onClick={closeGuide}
                className="mt-4 w-full rounded-lg bg-zinc-100 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-300"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {mode === 'draw' && drawCount > 0 && (
          <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur">
            <span className="text-sm font-medium text-zinc-100">
              {drawCount} point{drawCount > 1 ? 's' : ''}
            </span>
            <button
              onClick={removeLastDrawPoint}
              title="Remove last point (Ctrl+Z)"
              className="h-7 rounded-lg border border-zinc-700 px-2 text-xs text-zinc-200 transition hover:bg-zinc-800"
            >
              ⌫ Undo point
            </button>
            <button
              onClick={finishDraw}
              className="h-7 rounded-lg bg-emerald-500/90 px-2.5 text-xs font-medium text-white transition hover:bg-emerald-500"
            >
              Finish ✓
            </button>
            <button
              onClick={cancelDraw}
              title="Cancel drawing (Esc)"
              className="h-7 rounded-lg border border-zinc-700 px-2 text-xs text-zinc-200 transition hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        )}

        {expanded ? (
          <div className="absolute left-3 top-3 z-20 flex max-h-[calc(100%-3rem)] w-60 flex-col gap-2 overflow-y-auto">
            {regionsOpen && regions.length > 0 && (
              <div className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1.5 shadow-xl backdrop-blur">
                <div className="flex shrink-0 items-center justify-between px-2 py-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Regions ({regions.length})
                  </p>
                  <button
                    onClick={onToggleRegions}
                    title="Close region list"
                    className="text-zinc-500 hover:text-zinc-200"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex max-h-[140px] flex-col overflow-y-auto">
                  {regions.map(regionListItem)}
                </div>
              </div>
            )}
            {selectedRegion && (
              <div className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/90 p-2.5 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-100">
                    Region details
                  </p>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="text-zinc-500 hover:text-zinc-200"
                  >
                    ✕
                  </button>
                </div>
                {inspectorBody}
              </div>
            )}
          </div>
        ) : (
          <>
            {regionsOpen && regions.length > 0 && (
              <div className="absolute left-3 top-3 flex w-44 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/90 p-1.5 shadow-xl backdrop-blur">
                <div className="flex shrink-0 items-center justify-between px-2 py-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Regions ({regions.length})
                  </p>
                  <button
                    onClick={onToggleRegions}
                    title="Close region list"
                    className="text-zinc-500 hover:text-zinc-200"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex max-h-48 flex-col overflow-y-auto">
                  {regions.map(regionListItem)}
                </div>
              </div>
            )}
            {selectedRegion && (
              <div className="absolute right-3 top-3 w-60 rounded-xl border border-zinc-800 bg-zinc-900/90 p-2.5 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-100">
                    Region details
                  </p>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="text-zinc-500 hover:text-zinc-200"
                  >
                    ✕
                  </button>
                </div>
                {inspectorBody}
              </div>
            )}
          </>
        )}

        {materials.length > 0 &&
          (expanded ? (
            <div className="absolute bottom-14 right-3 top-3 flex w-64 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Materials
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                <button
                  onClick={() => pickMaterial(null)}
                  title="No material"
                  className={`mb-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-600 py-1 text-xs transition ${
                    paletteActive === null
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  ∅ No material
                </button>
                <div className="grid grid-cols-2 gap-1">
                  {materials.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => pickMaterial(m.id)}
                      title={m.name}
                      className={`flex flex-col items-center gap-0.5 rounded-lg p-0.5 transition ${
                        paletteActive === m.id
                          ? 'bg-zinc-100 text-zinc-950 ring-2 ring-zinc-100'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <img
                        src={imageUrl(`/materials/thumbs/${m.thumbnail}`)}
                        alt={m.name}
                        className="h-10 w-full rounded object-cover"
                      />
                      <span className="w-full truncate text-center text-[10px] leading-tight">
                        {m.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute bottom-3 left-1/2 flex max-w-[80%] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/90 p-1.5 shadow-xl backdrop-blur">
              <button
                onClick={() => pickMaterial(null)}
                title="No material"
                className={`flex w-16 shrink-0 flex-col items-center gap-1 rounded-lg p-1 transition ${
                  paletteActive === null
                    ? 'bg-zinc-100 text-zinc-950 ring-2 ring-zinc-100'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span className="flex h-10 w-14 items-center justify-center rounded border border-dashed border-zinc-600 text-lg">
                  ∅
                </span>
                <span className="w-full truncate text-center text-[10px]">
                  None
                </span>
              </button>
              {materials.map(materialTile)}
            </div>
          ))}

        <div
          className={`absolute bottom-3 right-3 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 shadow backdrop-blur ${
            expanded ? 'flex-row' : 'flex-col'
          }`}
        >
          <button
            onClick={() => zoomAt(1.3)}
            title="Zoom in"
            className="h-7 w-7 rounded-lg text-zinc-300 hover:bg-zinc-800"
          >
            +
          </button>
          <button
            onClick={fitView}
            title="Fit to screen"
            className="h-7 w-7 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800"
          >
            ⛶
          </button>
          <button
            onClick={() => zoomAt(1 / 1.3)}
            title="Zoom out"
            className="h-7 w-7 rounded-lg text-zinc-300 hover:bg-zinc-800"
          >
            −
          </button>
        </div>
      </div>

      <div className="flex h-6 shrink-0 items-center justify-between gap-2 border-t border-zinc-800 bg-zinc-900/60 px-2.5 text-[11px]">
        <p className="min-w-0 truncate text-zinc-400">{HELP_TEXT[mode]}</p>
        <div className="flex shrink-0 items-center gap-2">
          {scaleFt && scalePx && (
            <span className="flex items-center gap-1 text-zinc-400">
              <span className="h-1 w-1 rounded-full bg-amber-400" />
              Reference: {scaleFt} ft over {scalePx.toFixed(0)} px
            </span>
          )}
          {!selectedRegion && brushMaterial && (
            <span className="flex items-center gap-1 text-zinc-400">
              <img
                src={imageUrl(`/materials/thumbs/${brushMaterial.thumbnail}`)}
                alt={brushMaterial.name}
                className="h-4 w-6 rounded object-cover"
              />
              Brush: {brushMaterial.name}
            </span>
          )}
          {saveStatus !== 'idle' && (
            <span
              className={`${
                saveStatus === 'error'
                  ? 'text-red-400'
                  : saveStatus === 'saved'
                    ? 'text-emerald-400'
                    : 'text-zinc-500'
              }`}
            >
              {saveStatus === 'error'
                ? 'Save failed'
                : saveStatus === 'saved'
                  ? 'Saved'
                  : 'Saving…'}
            </span>
          )}
        </div>
      </div>

      {measurePrompt && (
        <MeasureModal
          distPx={measurePrompt.distPx}
          onConfirm={(ft) => {
            setScale(ft, measurePrompt.distPx)
            setMeasurePrompt(null)
          }}
          onCancel={() => setMeasurePrompt(null)}
        />
      )}
    </div>
  )
}
