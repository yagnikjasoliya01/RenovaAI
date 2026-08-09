export interface Material {
  id: string
  name: string
  category: string
  unit: string
  rate: number
  wastage: number
  labor_rate: number
  coverage_sqft_per_unit: number
  color?: string
  custom_color?: boolean
  suitable_for: string[]
  thumbnail: string
  texture: string
  blend: string
  description: string
}

export interface Region {
  id?: number
  label: string
  points: [number, number][]
  material_id: string | null
}

export interface Project {
  id: number
  name: string
  original_image: string
  generated_image: string | null
  scale_ft: number | null
  scale_px: number | null
  reference_note: string | null
  texture_scale: number | null
  regions: Region[]
}

export interface ProjectMeta {
  id: number
  name: string
  created_at: string | null
  region_count: number
  has_generated: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RegionEstimate {
  label: string
  material_id: string | null
  material_name: string | null
  area_sqft: number
  area_px: number
  quantity: number
  unit: string
  rate: number
  wastage: number
  material_cost: number
  labor_cost: number
  total_cost: number
}

export interface Estimate {
  regions: RegionEstimate[]
  totals: {
    material: number
    labor: number
    grand_total: number
  }
}

export type RegionLabel =
  | 'wall'
  | 'window'
  | 'door'
  | 'balcony'
  | 'pillar'
  | 'parapet'
  | 'gate'
  | 'roof_edge'
  | 'floor'

export interface LlmAnalysis {
  summary: string
  approx_material_cost: number
  approx_labor_cost: number
  approx_total: number
  notes: string[]
}

export interface ReportResult {
  id?: number
  title?: string
  created_at?: string
  engine?: Estimate
  llm?: LlmAnalysis
  original_image?: string
  generated_image?: string
  html: string
}
