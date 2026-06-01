'use client'

import { Loader2, Send, ShieldCheck } from 'lucide-react'
import { useKYCStatus, useSubmitKYC } from '@/lib/hooks/useKYC'
import { KYCStatusBanner } from '@/components/kyc/KYCStatusBanner'
import { BusinessProfileForm } from '@/components/kyc/BusinessProfileForm'
import { DocumentsSection } from '@/components/kyc/DocumentsSection'
import { KYC_STATUS_DISPLAY } from '@/components/kyc/constants'
import { Button } from '@/components/ui/button'

// =============================================================================
// Page Vérification KYC — /kyc
// =============================================================================

export default function KYCPage() {
  const { data: kyc, isLoading, isError } = useKYCStatus()
  const submit = useSubmitKYC()

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in">
        <div className="h-8 w-56 skeleton rounded" />
        <div className="h-16 w-full skeleton rounded-lg" />
        <div className="h-64 w-full skeleton rounded-lg" />
        <div className="h-48 w-full skeleton rounded-lg" />
      </div>
    )
  }

  if (isError || !kyc) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">
        Impossible de charger le statut de vérification. Réessayez plus tard.
      </div>
    )
  }

  const canEdit = kyc.status === 'unverified' || kyc.status === 'rejected'

  // Conditions de soumission (alignées sur le backend : profil complet + ≥1 doc).
  const profileComplete = Boolean(kyc.business_type && kyc.legal_name)
  const hasDocuments = kyc.documents.length > 0
  const canSubmit = canEdit && profileComplete && hasDocuments

  const statusDisplay = KYC_STATUS_DISPLAY[kyc.status]

  const submitHint = !canEdit
    ? null
    : !profileComplete
      ? 'Renseignez au moins le type d’entité et la raison sociale.'
      : !hasDocuments
        ? 'Ajoutez au moins un document avant de soumettre.'
        : null

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Vérification (KYC)</h1>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusDisplay.className}`}
            >
              {statusDisplay.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Vérifiez votre identité pour activer les paiements en production.
          </p>
        </div>
      </div>

      {/* Bandeau d'état */}
      <KYCStatusBanner kyc={kyc} />

      {/* Profil business */}
      <BusinessProfileForm kyc={kyc} readOnly={!canEdit} />

      {/* Documents */}
      <DocumentsSection documents={kyc.documents} editable={canEdit} />

      {/* Soumission */}
      {canEdit && (
        <div className="flex flex-col items-end gap-2">
          {submitHint && <p className="text-sm text-slate-500">{submitHint}</p>}
          <Button
            type="button"
            disabled={!canSubmit || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : kyc.status === 'rejected' ? (
              <Send className="h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {kyc.status === 'rejected' ? 'Soumettre à nouveau' : 'Soumettre pour vérification'}
          </Button>
        </div>
      )}
    </div>
  )
}
