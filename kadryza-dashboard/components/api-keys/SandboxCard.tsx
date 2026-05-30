'use client'

import { useState } from 'react'
import { FlaskConical, Loader2, Copy, Check, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useApiKeys, useGenerateTestApiKey } from '@/lib/hooks/useApiKeys'

// =============================================================================
// SandboxCard — Mode test (clé kadryza_test_ + numéros magiques)
// =============================================================================

export function SandboxCard() {
  const { data: keys } = useApiKeys()
  const generateMutation = useGenerateTestApiKey()
  const [revealedKey, setRevealedKey] = useState('')
  const [copied, setCopied] = useState(false)

  const testKey = keys?.find((k) => k.is_test)

  const handleGenerate = async () => {
    if (generateMutation.isPending) return
    try {
      const res = await generateMutation.mutateAsync()
      if (res.api_key) {
        setRevealedKey(res.api_key)
        toast.success('Clé de test générée')
      }
    } catch {
      // toast géré par le hook
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(revealedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <FlaskConical className="h-5 w-5 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">Mode test (Sandbox)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Testez vos intégrations avec une clé{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs text-amber-800">
              kadryza_test_
            </code>{' '}
            — sans gateway ni argent réel. Les transactions de test n&apos;affectent
            jamais votre solde.
          </p>

          {/* Clé révélée (une seule fois) ou statut */}
          {revealedKey ? (
            <div className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-3">
              <p className="mb-1.5 text-xs font-medium text-red-600">
                ⚠️ Copiez cette clé — elle ne sera plus affichée.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all break-all font-mono text-sm text-slate-900">
                  {revealedKey}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-600"
                  aria-label="Copier"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : testKey ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
              <code className="flex-1 font-mono text-sm text-slate-600">
                {testKey.prefix}{'•'.repeat(12)}
              </code>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Test
              </span>
            </div>
          ) : null}

          <div className="mt-4">
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="btn-primary"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : testKey ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              {testKey ? 'Régénérer la clé de test' : 'Générer une clé de test'}
            </button>
          </div>

          {/* Numéros magiques */}
          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900">Numéros de test</p>
            <p className="mt-0.5 text-xs text-slate-500">
              En mode test, l&apos;issue dépend du numéro de téléphone (résolu automatiquement ~2 s) :
            </p>
            <ul className="mt-2.5 space-y-1.5 text-sm text-slate-600">
              <li>
                <span className="inline-block w-5">✅</span>
                Tout autre numéro → paiement{' '}
                <span className="font-medium text-green-700">SUCCESS</span>
              </li>
              <li>
                <span className="inline-block w-5">❌</span>
                Numéro contenant <code className="rounded bg-slate-100 px-1 font-mono text-xs">0001</code> →{' '}
                <span className="font-medium text-red-700">FAILED</span>
              </li>
              <li>
                <span className="inline-block w-5">⏳</span>
                Numéro contenant <code className="rounded bg-slate-100 px-1 font-mono text-xs">0002</code> →{' '}
                reste en attente puis <span className="font-medium text-slate-700">TIMEOUT</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
