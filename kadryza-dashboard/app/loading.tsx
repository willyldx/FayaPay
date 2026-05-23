import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-4">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card animate-in fade-in zoom-in duration-500">
        <Loader2 className="h-8 w-8 animate-spin text-kadryza-500" />
      </div>
      <p className="text-sm font-medium text-slate-500 animate-pulse">Chargement de l'interface...</p>
    </div>
  )
}
