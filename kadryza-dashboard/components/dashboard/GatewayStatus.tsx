'use client'

import { useQuery } from '@tanstack/react-query'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import type { GatewayStatus as GatewayStatusType } from '@/lib/types'
import { formatDateRelative } from '@/lib/utils/format'

// =============================================================================
// GatewayStatus — Statut connexion gateway en temps réel
// =============================================================================

/**
 * Fetch le statut de la gateway.
 * GET /v1/gateway/status
 */
function fetchGatewayStatus(): Promise<GatewayStatusType> {
  return apiClient.get<GatewayStatusType>('/gateway/status')
}

export function GatewayStatus() {
  const {
    data: status,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['gateway', 'status'],
    queryFn: fetchGatewayStatus,
    refetchInterval: 30_000, // 30s — temps réel
    refetchIntervalInBackground: false, // [M-3 FIX] Stop polling en onglet inactif
    staleTime: 15_000,
  })

  return (
    <div className="card p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Statut Gateway
          </h2>
          <p className="text-sm text-slate-500">
            Connexion en temps réel
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex h-8 w-8 items-center justify-center rounded-lg
                     text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Rafraîchir le statut"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <GatewaySkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <WifiOff className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            Impossible de vérifier le statut
          </p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-kadryza-500 hover:text-kadryza-600 transition-colors"
          >
            Réessayer
          </button>
        </div>
      ) : status ? (
        <div className="space-y-4">
          {/* Statut global */}
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
            {status.is_connected ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                </span>
                <span className="text-sm font-medium text-green-700">
                  Connecté
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex h-3 w-3 rounded-full bg-red-500" />
                <span className="text-sm font-medium text-red-700">
                  Déconnecté
                </span>
              </>
            )}
          </div>

          {/* Statut par opérateur */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Opérateurs
            </p>
            {status.operators.map((op) => (
              <div
                key={op.operator}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {op.is_connected ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-400" />
                  )}
                  <div>
                    <span className="text-sm font-medium text-slate-900">
                      {op.operator === 'AIRTEL'
                        ? 'Airtel Money'
                        : 'Moov Money'}
                    </span>
                    <p className="text-xs text-slate-400">
                      {formatDateRelative(op.last_check)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    op.is_connected
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {op.is_connected ? '✓ OK' : '✗ Down'}
                </span>
              </div>
            ))}
          </div>

          {/* Dernière mise à jour */}
          {dataUpdatedAt && (
            <p className="text-xs text-slate-400 text-center pt-2">
              Mis à jour {formatDateRelative(new Date(dataUpdatedAt).toISOString())}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

// =============================================================================
// Skeleton
// =============================================================================

function GatewaySkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 skeleton rounded-lg" />
      <div className="space-y-2.5">
        <div className="h-3 w-20 skeleton rounded" />
        <div className="h-14 skeleton rounded-lg" />
        <div className="h-14 skeleton rounded-lg" />
      </div>
    </div>
  )
}
