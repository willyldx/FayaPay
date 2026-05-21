'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, RotateCcw, ChevronDown } from 'lucide-react'
import type {
  TransactionFilters as TxFilters,
  TransactionStatus,
  OperatorType,
  DatePreset,
} from '@/lib/types'

// =============================================================================
// TransactionFilters — Filtres interactifs
// =============================================================================

interface TransactionFiltersProps {
  filters: TxFilters
  onChange: (filters: Partial<TxFilters>) => void
  onReset: () => void
}

// --- Options ---

const STATUS_OPTIONS: { value: TransactionStatus; label: string }[] = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'PROCESSING', label: 'En cours' },
  { value: 'WAITING_SMS', label: 'Attente SMS' },
  { value: 'SUCCESS', label: 'Réussi' },
  { value: 'FAILED', label: 'Échoué' },
  { value: 'TIMEOUT', label: 'Expiré' },
  { value: 'REFUNDED', label: 'Remboursé' },
]

const OPERATOR_OPTIONS: { value: OperatorType | ''; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'AIRTEL', label: 'Airtel' },
  { value: 'MOOV', label: 'Moov' },
]

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: 'custom', label: 'Personnalisé' },
]

export function TransactionFilters({
  filters,
  onChange,
  onReset,
}: TransactionFiltersProps) {
  // --- Recherche avec debounce ---
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        onChange({ search: value || undefined })
      }, 300)
    },
    [onChange]
  )

  // Sync search input quand filters.search change (ex: reset)
  useEffect(() => {
    setSearchInput(filters.search ?? '')
  }, [filters.search])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  // --- Période ---
  const [datePreset, setDatePreset] = useState<DatePreset | ''>('')
  const [customFrom, setCustomFrom] = useState(filters.date_from ?? '')
  const [customTo, setCustomTo] = useState(filters.date_to ?? '')

  const handleDatePreset = (preset: DatePreset) => {
    setDatePreset(preset)
    const now = new Date()
    let from: string | undefined
    const to = now.toISOString()

    switch (preset) {
      case 'today': {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        from = today.toISOString()
        break
      }
      case '7d':
        from = new Date(now.getTime() - 7 * 86_400_000).toISOString()
        break
      case '30d':
        from = new Date(now.getTime() - 30 * 86_400_000).toISOString()
        break
      case 'custom':
        // Ne pas changer les dates, attendre l'input utilisateur
        return
    }

    onChange({ date_from: from, date_to: to })
  }

  const handleCustomDate = () => {
    if (customFrom && customTo) {
      onChange({
        date_from: new Date(customFrom).toISOString(),
        date_to: new Date(customTo + 'T23:59:59').toISOString(),
      })
    }
  }

  // --- Compteur de filtres actifs ---
  const activeCount = [
    filters.status,
    filters.operator,
    filters.date_from,
    filters.search,
  ].filter(Boolean).length

  const handleReset = () => {
    setDatePreset('')
    setCustomFrom('')
    setCustomTo('')
    setSearchInput('')
    onReset()
  }

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        {/* Recherche */}
        <div className="flex-1">
          <label htmlFor="tx-search" className="text-xs font-medium text-slate-500 mb-1.5 block">
            Recherche par référence
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="tx-search"
              type="text"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Référence de transaction…"
              className="input pl-10 pr-9"
            />
            {searchInput && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Statut */}
        <div className="w-full lg:w-44">
          <label htmlFor="tx-status" className="text-xs font-medium text-slate-500 mb-1.5 block">
            Statut
          </label>
          <div className="relative">
            <select
              id="tx-status"
              value={filters.status ?? ''}
              onChange={(e) =>
                onChange({
                  status: (e.target.value as TransactionStatus) || undefined,
                })
              }
              className="input appearance-none pr-9"
            >
              <option value="">Tous les statuts</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Opérateur */}
        <div className="w-full lg:w-36">
          <label htmlFor="tx-operator" className="text-xs font-medium text-slate-500 mb-1.5 block">
            Opérateur
          </label>
          <div className="relative">
            <select
              id="tx-operator"
              value={filters.operator ?? ''}
              onChange={(e) =>
                onChange({
                  operator: (e.target.value as OperatorType) || undefined,
                })
              }
              className="input appearance-none pr-9"
            >
              {OPERATOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Période */}
        <div className="w-full lg:w-44">
          <label htmlFor="tx-period" className="text-xs font-medium text-slate-500 mb-1.5 block">
            Période
          </label>
          <div className="relative">
            <select
              id="tx-period"
              value={datePreset}
              onChange={(e) => handleDatePreset(e.target.value as DatePreset)}
              className="input appearance-none pr-9"
            >
              <option value="">Toute la période</option>
              {DATE_PRESETS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Reset */}
        {activeCount > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5
                       text-sm font-medium text-slate-600
                       transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Réinitialiser
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-faya-100 text-xs font-semibold text-faya-600 px-1">
              {activeCount}
            </span>
          </button>
        )}
      </div>

      {/* Dates personnalisées */}
      {datePreset === 'custom' && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end border-t border-slate-100 pt-4">
          <div className="flex-1">
            <label htmlFor="tx-date-from" className="text-xs font-medium text-slate-500 mb-1.5 block">
              Date début
            </label>
            <input
              id="tx-date-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="tx-date-to" className="text-xs font-medium text-slate-500 mb-1.5 block">
              Date fin
            </label>
            <input
              id="tx-date-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="input"
            />
          </div>
          <button
            onClick={handleCustomDate}
            disabled={!customFrom || !customTo}
            className="btn-primary whitespace-nowrap"
          >
            Appliquer
          </button>
        </div>
      )}
    </div>
  )
}
