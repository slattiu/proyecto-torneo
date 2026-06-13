'use client'

import React, { useState, useRef } from 'react'
import { Orbitron } from 'next/font/google'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { upsertAdPlacement, deleteAdPlacement, type AdPlacementData } from '@/lib/actions/ads'
import { toast } from 'sonner'

const orbitron = Orbitron({ subsets: ['latin'] })

interface AdsClientProps {
  initialAds: any[]
}

const COMMON_SLOTS = [
  { value: 'home_hero_banner', label: 'Inicio - Banner Hero Principal (1200x200)' },
  { value: 'leaderboard_sidebar', label: 'Leaderboard - Barra Lateral (300x600)' },
  { value: 'bracket_footer', label: 'Bracket - Pie de Página' },
]

export function AdsClient({ initialAds }: AdsClientProps) {
  const router = useRouter()
  const [ads, setAds] = useState<any[]>(initialAds)
  const [editingAd, setEditingAd] = useState<Partial<AdPlacementData> | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleEdit = (ad: any) => {
    setEditingAd({
      id: ad.id,
      slot_name: ad.slot_name,
      advertiser_name: ad.advertiser_name,
      image_url: ad.image_url,
      click_through_url: ad.click_through_url || '',
      is_active: ad.is_active,
    })
  }

  const handleCreateNew = () => {
    setEditingAd({
      slot_name: 'home_hero_banner',
      advertiser_name: '',
      image_url: '',
      click_through_url: '',
      is_active: true,
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `ad-${Date.now()}.${fileExt}`
      const filePath = `branding/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidences')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('evidences')
        .getPublicUrl(filePath)

      setEditingAd(prev => prev ? {
        ...prev,
        image_url: publicUrl
      } : null)
      
      toast.success('Archivo publicitario subido correctamente.')
    } catch (err: any) {
      toast.error('Error al subir archivo: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este anuncio?')) return

    try {
      const res = await deleteAdPlacement(id)
      if ('error' in res) throw new Error(res.error)

      setAds(prev => prev.filter(ad => ad.id !== id))
      toast.success('Anuncio eliminado con éxito')
      router.refresh()
    } catch (err: any) {
      toast.error('Error al eliminar el anuncio: ' + err.message)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAd || !editingAd.slot_name || !editingAd.advertiser_name || !editingAd.image_url) {
      toast.error('Por favor, completa todos los campos requeridos.')
      return
    }

    try {
      const res = await upsertAdPlacement(editingAd as AdPlacementData)
      if ('error' in res) throw new Error(res.error)

      toast.success('Anuncio guardado correctamente')
      setEditingAd(null)
      
      // Reload ads list
      const { data: refreshed } = await supabase
        .from('advertising_placements')
        .select('*')
        .order('slot_name', { ascending: true })
        
      if (refreshed) {
        setAds(refreshed)
      }
      router.refresh()
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message)
    }
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className={`${orbitron.className} text-2xl sm:text-3xl font-black text-white uppercase tracking-widest`}>
            Administración de Publicidad
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Administra los banners publicitarios que se muestran en el sitio. Soporta carga de archivos de imagen y video directos.
          </p>
        </div>
        
        <button
          onClick={handleCreateNew}
          className="px-6 py-3 bg-neon-cyan text-black font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(0,245,255,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-all self-start sm:self-auto"
        >
          + Añadir Anuncio
        </button>
      </div>

      {/* Ads List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ads.length > 0 ? (
          ads.map(ad => {
            const isVideo = ad.image_url.toLowerCase().match(/\.(mp4|webm|ogg)$/) || ad.image_url.includes('/video/')
            return (
              <div 
                key={ad.id} 
                className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex flex-col justify-between gap-4 hover:border-white/10 transition-all duration-300 relative group overflow-hidden"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan px-2.5 py-1 rounded-full font-black uppercase tracking-widest truncate max-w-[200px]">
                      {ad.slot_name}
                    </span>
                    <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest ${
                      ad.is_active 
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
                        : 'bg-white/5 border border-white/10 text-white/30'
                    }`}>
                      {ad.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  
                  <h3 className="text-white text-base font-bold uppercase tracking-tight mt-2">
                    {ad.advertiser_name}
                  </h3>
                  
                  {ad.click_through_url && (
                    <p className="text-white/40 text-xs truncate mt-1">
                      🔗 <a href={ad.click_through_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{ad.click_through_url}</a>
                    </p>
                  )}
                </div>

                {/* Media Preview Box */}
                <div className="border border-white/5 bg-black/40 rounded-2xl overflow-hidden relative min-h-[120px] flex items-center justify-center">
                  {isVideo ? (
                    <video
                      src={ad.image_url}
                      className="max-h-[120px] w-full object-cover"
                      controls
                      muted
                    />
                  ) : (
                    <img
                      src={ad.image_url}
                      alt={ad.advertiser_name}
                      className="max-h-[120px] w-full object-contain p-2"
                    />
                  )}
                  <span className="absolute bottom-2 right-2 text-[8px] bg-black/60 px-2 py-0.5 rounded text-white/50 uppercase tracking-widest font-black">
                    {isVideo ? 'Vídeo' : 'Imagen'}
                  </span>
                </div>

                {/* Performance stats (Impressions & clicks) */}
                <div className="flex gap-4 text-xs font-bold uppercase text-white/40 tracking-wider">
                  <div>Impresiones: <span className="text-white">{ad.impressions_count || 0}</span></div>
                  <div>Clicks: <span className="text-white">{ad.clicks_count || 0}</span></div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-white/5 pt-4 mt-2">
                  <button
                    onClick={() => handleEdit(ad)}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(ad.id)}
                    className="py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs uppercase tracking-widest rounded-xl transition-all"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="md:col-span-2 text-center p-12 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl">
            <span className="text-4xl mb-3 block grayscale opacity-30">📢</span>
            <h3 className="text-white/60 font-bold uppercase tracking-widest text-sm">No hay banners publicitarios</h3>
            <p className="text-white/30 text-xs mt-1">Presiona "Añadir Anuncio" para integrar tu primer banner.</p>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {editingAd && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleSave}
            className="bg-[#121219] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-6 animate-in fade-in zoom-in-95 duration-200"
          >
            <div>
              <h2 className={`${orbitron.className} text-xl font-black text-white uppercase tracking-wider`}>
                {editingAd.id ? 'Editar Anuncio' : 'Crear Nuevo Anuncio'}
              </h2>
              <p className="text-white/40 text-xs mt-1">Configura las propiedades del patrocinador oficial.</p>
            </div>

            <div className="space-y-4">
              {/* Advertiser Name */}
              <div className="space-y-1">
                <label className="text-white/60 font-bold uppercase tracking-widest text-[9px] block">Nombre del Anunciante</label>
                <input
                  type="text"
                  required
                  value={editingAd.advertiser_name || ''}
                  onChange={e => setEditingAd(prev => prev ? { ...prev, advertiser_name: e.target.value } : null)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors"
                  placeholder="Ej: Claro Gaming RD"
                />
              </div>

              {/* Slot Name */}
              <div className="space-y-1">
                <label className="text-white/60 font-bold uppercase tracking-widest text-[9px] block">Ubicación (Slot Name)</label>
                <select
                  value={editingAd.slot_name || ''}
                  onChange={e => setEditingAd(prev => prev ? { ...prev, slot_name: e.target.value } : null)}
                  className="w-full px-4 py-3 bg-[#121219] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors"
                >
                  {COMMON_SLOTS.map(slot => (
                    <option key={slot.value} value={slot.value}>{slot.label}</option>
                  ))}
                  {/* Keep compatibility with custom values */}
                  {!COMMON_SLOTS.find(s => s.value === editingAd.slot_name) && editingAd.slot_name && (
                    <option value={editingAd.slot_name}>{editingAd.slot_name}</option>
                  )}
                </select>
              </div>

              {/* Click-Through URL */}
              <div className="space-y-1">
                <label className="text-white/60 font-bold uppercase tracking-widest text-[9px] block">URL de Destino (Redirección al Clic)</label>
                <input
                  type="url"
                  value={editingAd.click_through_url || ''}
                  onChange={e => setEditingAd(prev => prev ? { ...prev, click_through_url: e.target.value } : null)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors"
                  placeholder="Ej: https://www.claro.com.do"
                />
              </div>

              {/* Media File Upload or URL */}
              <div className="space-y-2 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
                <label className="text-white/60 font-bold uppercase tracking-widest text-[9px] block">Archivo del Anuncio (Vídeo o Imagen)</label>
                
                <div className="flex gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,video/mp4,video/webm"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2.5 px-4 bg-white/5 border border-white/10 hover:border-neon-cyan/50 rounded-xl text-xs font-bold text-white uppercase tracking-widest transition-all text-center"
                  >
                    {uploading ? 'Subiendo...' : 'Subir Archivo'}
                  </button>
                </div>

                <div className="space-y-1 mt-2">
                  <label className="text-white/40 font-bold uppercase tracking-widest text-[8px] block">O URL de la imagen/video</label>
                  <input
                    type="text"
                    required
                    value={editingAd.image_url || ''}
                    onChange={e => setEditingAd(prev => prev ? { ...prev, image_url: e.target.value } : null)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-neon-cyan transition-colors"
                    placeholder="https://via.placeholder.com/1200x200"
                  />
                </div>

                {/* Preview block inside modal */}
                {editingAd.image_url && (
                  <div className="border border-white/5 bg-black/40 rounded-xl p-2 mt-2 flex flex-col items-center justify-center">
                    {(() => {
                      const isVideo = editingAd.image_url.toLowerCase().match(/\.(mp4|webm|ogg)$/) || editingAd.image_url.includes('/video/')
                      return isVideo ? (
                        <video src={editingAd.image_url} className="max-h-[80px] rounded" controls muted />
                      ) : (
                        <img src={editingAd.image_url} alt="Previsualización" className="max-h-[80px] object-contain rounded" />
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Status active */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="ad_is_active"
                  checked={editingAd.is_active || false}
                  onChange={e => setEditingAd(prev => prev ? { ...prev, is_active: e.target.checked } : null)}
                  className="w-4 h-4 accent-neon-cyan bg-white/5 border border-white/10 rounded focus:ring-0 cursor-pointer"
                />
                <label htmlFor="ad_is_active" className="text-white/80 font-bold uppercase tracking-widest text-[9px] select-none cursor-pointer">
                  Activar Banner (Visible en la web)
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-white/5 pt-6">
              <button
                type="button"
                onClick={() => setEditingAd(null)}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-8 py-2.5 bg-neon-cyan text-black font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(0,245,255,0.4)] transition-all"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
