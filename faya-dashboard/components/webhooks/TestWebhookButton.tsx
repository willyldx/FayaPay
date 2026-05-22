'use client'

import { useState } from 'react'
import {
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
} from 'lucide-react'
import { useTestWebhook } from '@/lib/hooks/useWebhooks'
import type { WebhookTestResult } from '@/lib/types'

// =============================================================================
// TestWebhookButton — Bouton test + affichage résultat HTTP
// =============================================================================

interface TestWebhookButtonProps {
  webhookId: string
  disabled?: boolean
}

export function TestWebhookButton({ webhookId, disabled }: TestWebhookButtonProps) {
  const testMutation = useTestWebhook()
  const [result, setResult] = useState<WebhookTestResult | null>(null)
  const [showResult, setShowResult] = useState(false)

  const handleTest = async () => {
    setResult(null)
    setShowResult(true)
    try {
      const res = await testMutation.mutateAsync(webhookId)
      setResult(res)
    } catch {
      setResult({
        success: false,
        error: 'Impossible d\'envoyer le test. Vérifiez votre connexion.',
      })
    }
  }

  const handleReset = () => {
    setResult(null)
    setShowResult(false)
  }

  const isSuccess = result?.success && result.status_code && result.status_code >= 200 && result.status_code < 300
  const isTimeout = result && !result.success && !result.status_code && result.error?.toLowerCase().includes('timeout')

  return (
    <div className="relative">
      {/* Bouton test */}
      <button
        onClick={handleTest}
        disabled={disabled || testMutation.isPending}
        className="flex items-center gap-1.5 rounded-lg border border-faya-200 px-3 py-2
                   text-sm font-medium text-faya-600
                   transition-colors hover:bg-faya-50
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {testMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Tester</span>
      </button>

      {/* Résultat (popover) */}
      {showResult && (
        <div className="absolute right-0 top-full mt-2 z-10 w-72 rounded-xl border border-slate-200 bg-white shadow-xl animate-in">
          <div className="p-4">
            {/* En cours */}
            {testMutation.isPending && !result && (
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-faya-500" />
                <div>
                  <p className="font-medium text-slate-700">Test en cours…</p>
                  <p className="text-xs text-slate-400">Envoi du payload fictif</p>
                </div>
              </div>
            )}

            {/* Résultat */}
            {result && (
              <div className="space-y-3">
                {/* Statut */}
                <div className="flex items-center gap-3">
                  {isSuccess ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                  ) : isTimeout ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-100">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        isSuccess
                          ? 'text-green-700'
                          : isTimeout
                          ? 'text-yellow-700'
                          : 'text-red-700'
                      }`}
                    >
                      {isSuccess
                        ? 'Test réussi'
                        : isTimeout
                        ? 'Timeout'
                        : 'Test échoué'}
                    </p>
                    {result.status_code && (
                      <p className="text-xs text-slate-500">
                        HTTP{' '}
                        <span
                          className={`font-mono font-semibold ${
                            isSuccess ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {result.status_code}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Détails */}
                <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs">
                  {result.status_code && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Code HTTP</span>
                      <span
                        className={`font-mono font-semibold ${
                          isSuccess ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {result.status_code}
                      </span>
                    </div>
                  )}
                  {result.response_time_ms !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Temps de réponse</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {result.response_time_ms}ms
                      </span>
                    </div>
                  )}
                  {result.error && (
                    <div className="pt-1.5 border-t border-slate-200">
                      <p className="text-red-600">{result.error}</p>
                    </div>
                  )}
                  {isTimeout && !result.error && (
                    <div className="pt-1.5 border-t border-slate-200">
                      <p className="text-yellow-700">
                        Le serveur n&apos;a pas répondu dans les temps.
                        Vérifiez que votre endpoint est accessible.
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-1">
                  <button
                    onClick={handleTest}
                    disabled={testMutation.isPending}
                    className="flex items-center gap-1.5 text-xs font-medium text-faya-500 hover:text-faya-600 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Relancer
                  </button>
                  <button
                    onClick={handleReset}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay transparent pour fermer le popover */}
      {showResult && (
        <div
          className="fixed inset-0 z-[5]"
          onClick={handleReset}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
