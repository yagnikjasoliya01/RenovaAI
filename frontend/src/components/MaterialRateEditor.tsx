import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getMaterials, updateMaterialRates, resetMaterialRates } from '../api'
import type { Material } from '../types'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  onClose: () => void
}

interface EditableMaterial extends Material {
  is_custom?: boolean
}

export default function MaterialRateEditor({ onClose }: Props) {
  const [materials, setMaterials] = useState<EditableMaterial[]>([])
  const [editedRates, setEditedRates] = useState<Record<string, { rate: number; labor_rate: number }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  useEffect(() => {
    loadMaterials()
  }, [])

  const loadMaterials = async () => {
    try {
      const data = await getMaterials()
      setMaterials(data)
      setLoading(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load materials')
      setLoading(false)
    }
  }

  const handleRateChange = (materialId: string, field: 'rate' | 'labor_rate', value: string) => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue < 0) return

    const material = materials.find(m => m.id === materialId)
    if (!material) return

    setEditedRates(prev => ({
      ...prev,
      [materialId]: {
        rate: field === 'rate' ? numValue : (prev[materialId]?.rate ?? material.rate),
        labor_rate: field === 'labor_rate' ? numValue : (prev[materialId]?.labor_rate ?? material.labor_rate),
      },
    }))
  }

  const getCurrentRate = (material: EditableMaterial, field: 'rate' | 'labor_rate') => {
    if (editedRates[material.id]?.[field] !== undefined) {
      return editedRates[material.id][field]
    }
    return material[field]
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const updates = Object.entries(editedRates).map(([material_id, rates]) => {
        // Find the original material to get default values
        const material = materials.find(m => m.id === material_id)
        return {
          material_id,
          rate: rates.rate ?? material?.rate ?? 0,
          labor_rate: rates.labor_rate ?? material?.labor_rate ?? 0,
        }
      })

      await updateMaterialRates(updates)

      // Reload materials to show updated custom rates
      await loadMaterials()
      setEditedRates({})
      toast.success(`Successfully updated ${updates.length} material rate${updates.length !== 1 ? 's' : ''}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save rates')
    } finally {
      setSaving(false)
    }
  }

  const handleResetConfirm = async () => {
    setSaving(true)

    try {
      await resetMaterialRates()
      await loadMaterials()
      setEditedRates({})
      setShowResetConfirm(false)
      toast.success('Successfully reset all rates to defaults')
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset rates')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = Object.keys(editedRates).length > 0

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-lg bg-zinc-900 p-8 border border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-blue-500" />
            <p className="text-zinc-300">Loading materials...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Material Rate Editor</h2>
            <p className="text-sm text-zinc-400">Customize material and labor costs</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-zinc-800 text-left text-sm font-semibold text-zinc-300 z-10">
              <tr>
                <th className="p-3 border-b border-zinc-700">Material</th>
                <th className="p-3 border-b border-zinc-700">Category</th>
                <th className="p-3 border-b border-zinc-700">Unit</th>
                <th className="p-3 text-right border-b border-zinc-700">Material Rate (₹)</th>
                <th className="p-3 text-right border-b border-zinc-700">Labor Rate (₹)</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {materials.map((material, index) => (
                <tr
                  key={material.id}
                  className={`border-b border-zinc-800 transition-colors ${
                    material.is_custom 
                      ? 'bg-blue-500/5 hover:bg-blue-500/10' 
                      : index % 2 === 0 
                        ? 'hover:bg-zinc-800/50' 
                        : 'bg-zinc-900/50 hover:bg-zinc-800/50'
                  }`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-100">{material.name}</span>
                      {material.is_custom && (
                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                          Custom
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-zinc-400 capitalize">{material.category}</td>
                  <td className="p-3 text-zinc-400">{material.unit}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={getCurrentRate(material, 'rate')}
                      onChange={(e) => handleRateChange(material.id, 'rate', e.target.value)}
                      disabled={saving}
                      className="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-right text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={getCurrentRate(material, 'labor_rate')}
                      onChange={(e) => handleRateChange(material.id, 'labor_rate', e.target.value)}
                      disabled={saving}
                      className="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-right text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 p-4">
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={saving}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <ConfirmDialog
          title="Reset Material Rates"
          message="Reset all material rates to defaults? This will remove all your custom pricing and cannot be undone."
          confirmText="Reset to Defaults"
          cancelText="Cancel"
          confirmVariant="danger"
          loading={saving}
          onConfirm={handleResetConfirm}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  )
}
