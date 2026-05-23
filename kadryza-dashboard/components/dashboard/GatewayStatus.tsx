"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api/client"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Smartphone } from "lucide-react"

// =============================================================================
// API & Types
// =============================================================================

export type OperatorType = 'AIRTEL' | 'MOOV'

export interface OperatorStatus {
  operator: OperatorType
  is_connected: boolean
  last_check: string
}

export interface GatewayStatusType {
  is_connected: boolean
  operators: OperatorStatus[]
}

/**
 * GET /v1/dashboard/gateway/status
 */
export function fetchGatewayStatus(): Promise<GatewayStatusType> {
  return apiClient
    .get<{
      gateways: Array<{
        gateway_id: string
        operators: string[]
        sim_status: Record<string, string>
        connected_at: string
        last_pong_at: string
      }>
      total: number
    }>('/dashboard/gateway/status')
    .then((res) => {
      const is_connected = res.total > 0
      const supportedOperators = ['AIRTEL', 'MOOV'] as const
      const activeOperators = new Map<string, string>()

      if (is_connected && res.gateways) {
        res.gateways.forEach((gw) => {
          if (Array.isArray(gw.operators)) {
            gw.operators.forEach((op) => {
              activeOperators.set(op, gw.last_pong_at)
            })
          }
        })
      }

      return {
        is_connected,
        operators: supportedOperators.map((op) => ({
          operator: op,
          is_connected: activeOperators.has(op),
          last_check: activeOperators.get(op) || new Date().toISOString(),
        })),
      }
    })
}

// =============================================================================
// Component
// =============================================================================

export function GatewayStatus() {
  const [status, setStatus] = useState<GatewayStatusType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        setError(false)
        const data = await fetchGatewayStatus()
        if (mounted) {
          setStatus(data)
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setError(true)
          setLoading(false)
        }
      }
    }

    fetchData()
    // Rafraîchissement automatique toutes les 15s
    const interval = setInterval(fetchData, 15000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold text-card-foreground">
          Passerelle Matérielle
        </CardTitle>
        <Smartphone className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 font-medium">
              Impossible de joindre la gateway
            </p>
          </div>
        ) : !status?.is_connected ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex flex-col items-center justify-center text-center gap-2">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900">Application déconnectée</p>
              <p className="text-xs text-red-700 mt-1">
                Veuillez démarrer l'application Android Kadryza sur votre téléphone.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {status.operators.map((op) => {
              const opName = op.operator === 'AIRTEL' ? 'Airtel Money API' : 'Moov Money API'
              const opStatus = op.is_connected ? 'opérationnel' : 'hors ligne'
              
              return (
                <div 
                  key={op.operator} 
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      op.is_connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                    )} />
                    <span className="font-medium text-foreground text-sm">{opName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-xs font-medium capitalize",
                      op.is_connected ? "text-emerald-600" : "text-red-600"
                    )}>
                      {opStatus}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
