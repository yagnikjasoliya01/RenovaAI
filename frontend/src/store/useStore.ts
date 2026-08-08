import { create } from 'zustand'
import type { ChatMessage, Material, ProjectMeta, Region } from '../types'

interface Snapshot {
  regions: Region[]
  scaleFt: number | null
  scalePx: number | null
}

interface ProjectState {
  activeId: number | null
  projectName: string
  originalImage: string | null
  generatedImage: string | null
  scaleFt: number | null
  scalePx: number | null
  textureScale: number
  regions: Region[]
  materials: Material[]
  projects: ProjectMeta[]
  chatByProject: Record<number, ChatMessage[]>
  past: Snapshot[]
  future: Snapshot[]
  setActive: (id: number | null) => void
  setProjectData: (data: {
    name: string
    original_image: string
    generated_image: string | null
    scale_ft: number | null
    scale_px: number | null
    texture_scale: number | null
    regions: Region[]
  }) => void
  setGeneratedImage: (image: string | null) => void
  addRegion: (region: Region) => number
  updateRegion: (id: number, patch: Partial<Region>) => void
  updateRegionNoHistory: (id: number, patch: Partial<Region>) => void
  removeRegion: (id: number) => void
  setScale: (scaleFt: number | null, scalePx: number | null) => void
  setTextureScale: (scale: number) => void
  beginEdit: () => void
  undo: () => void
  redo: () => void
  resetHistory: () => void
  setMaterials: (materials: Material[]) => void
  setProjects: (projects: ProjectMeta[]) => void
  upsertProjectMeta: (meta: ProjectMeta) => void
  removeProjectMeta: (id: number) => void
  chatPush: (projectId: number, msg: ChatMessage) => void
  setChat: (projectId: number, msgs: ChatMessage[]) => void
}

const initialState = {
  activeId: null,
  projectName: '',
  originalImage: null,
  generatedImage: null,
  scaleFt: null,
  scalePx: null,
  textureScale: 1,
  regions: [],
  materials: [],
  projects: [],
  chatByProject: {},
  past: [],
  future: [],
}

const MAX_HISTORY = 50

const snap = (s: ProjectState): Snapshot => ({
  regions: s.regions,
  scaleFt: s.scaleFt,
  scalePx: s.scalePx,
})

export const useStore = create<ProjectState>((set) => ({
  ...initialState,
  setActive: (id) => set({ activeId: id }),
  setProjectData: (data) =>
    set({
      projectName: data.name,
      originalImage: data.original_image,
      generatedImage: data.generated_image,
      scaleFt: data.scale_ft,
      scalePx: data.scale_px,
      textureScale: data.texture_scale ?? 1,
      regions: data.regions,
    }),
  setGeneratedImage: (image) => set({ generatedImage: image }),
  addRegion: (region) => {
    const id = region.id ?? -Date.now()
    set((s) => ({
      past: [...s.past, snap(s)].slice(-MAX_HISTORY),
      future: [],
      regions: [...s.regions, { ...region, id }],
    }))
    return id
  },
  updateRegion: (id, patch) =>
    set((s) => ({
      past: [...s.past, snap(s)].slice(-MAX_HISTORY),
      future: [],
      regions: s.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  updateRegionNoHistory: (id, patch) =>
    set((s) => ({
      regions: s.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  removeRegion: (id) =>
    set((s) => ({
      past: [...s.past, snap(s)].slice(-MAX_HISTORY),
      future: [],
      regions: s.regions.filter((r) => r.id !== id),
    })),
  setScale: (scaleFt, scalePx) =>
    set((s) => ({
      past: [...s.past, snap(s)].slice(-MAX_HISTORY),
      future: [],
      scaleFt,
      scalePx,
    })),
  setTextureScale: (textureScale) => set({ textureScale }),
  beginEdit: () =>
    set((s) => ({
      past: [...s.past, snap(s)].slice(-MAX_HISTORY),
      future: [],
    })),
  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1]
      if (!prev) return s
      return {
        regions: prev.regions,
        scaleFt: prev.scaleFt,
        scalePx: prev.scalePx,
        past: s.past.slice(0, -1),
        future: [snap(s), ...s.future],
      }
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0]
      if (!next) return s
      return {
        regions: next.regions,
        scaleFt: next.scaleFt,
        scalePx: next.scalePx,
        future: s.future.slice(1),
        past: [...s.past, snap(s)],
      }
    }),
  resetHistory: () => set({ past: [], future: [] }),
  setMaterials: (materials) => set({ materials }),
  setProjects: (projects) => set({ projects }),
  upsertProjectMeta: (meta) =>
    set((s) => {
      const exists = s.projects.some((p) => p.id === meta.id)
      return {
        projects: exists
          ? s.projects.map((p) => (p.id === meta.id ? meta : p))
          : [meta, ...s.projects],
      }
    }),
  removeProjectMeta: (id) =>
    set((s) => {
      const chatByProject = { ...s.chatByProject }
      delete chatByProject[id]
      return {
        projects: s.projects.filter((p) => p.id !== id),
        chatByProject,
      }
    }),
  chatPush: (projectId, msg) =>
    set((s) => ({
      chatByProject: {
        ...s.chatByProject,
        [projectId]: [...(s.chatByProject[projectId] ?? []), msg],
      },
    })),
  setChat: (projectId, msgs) =>
    set((s) => ({
      chatByProject: { ...s.chatByProject, [projectId]: msgs },
    })),
}))
