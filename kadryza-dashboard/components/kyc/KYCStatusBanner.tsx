'use client'

import { AlertCircle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react'
import type { KYCStatusResponse } from '@/lib/types'

// =============================================================================
// Bandeau d'état KYC — message contextuel selon le statut
// =============================================================================

function formatDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export function KYCStatusBanner({ kyc }: { kyc: KYCStatusResponse }) {
  switch (kyc.status) {
    case 'verified':
      return (
        <Banner
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          tone="bg-emerald-50 border-emerald-200"
          title="Compte vérifié"
          titleClass="text-emerald-900"
          bodyClass="text-emerald-700"
        >
          Votre identité a été vérifiée{kyc.reviewed_at ? ` le ${formatDate(kyc.reviewed_at)}` : ''}.
          Vous pouvez encaisser des paiements en production.
        </Banner>
      )

    case 'pending':
      return (
        <Banner
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          tone="bg-amber-50 border-amber-200"
          title="Dossier en cours d’examen"
          titleClass="text-amber-900"
          bodyClass="text-amber-700"
        >
          Votre dossier a été soumis{kyc.submitted_at ? ` le ${formatDate(kyc.submitted_at)}` : ''} et
          est en cours de vérification par notre équipe. Vous serez notifié dès qu’une décision sera prise.
        </Banner>
      )

    case 'rejected':
      return (
        <Banner
          icon={<ShieldAlert className="h-5 w-5 text-red-600" />}
          tone="bg-red-50 border-red-200"
          title="Dossier rejeté"
          titleClass="text-red-900"
          bodyClass="text-red-700"
        >
          {kyc.rejection_reason
            ? <>Motif : <span className="font-medium">{kyc.rejection_reason}</span>. </>
            : null}
          Corrigez les informations ci-dessous puis soumettez à nouveau votre dossier.
        </Banner>
      )

    default: // unverified
      return (
        <Banner
          icon={<AlertCircle className="h-5 w-5 text-blue-600" />}
          tone="bg-blue-50 border-blue-200"
          title="Vérification requise pour la production"
          titleClass="text-blue-900"
          bodyClass="text-blue-700"
        >
          Complétez votre profil business et ajoutez au moins un document d’identité,
          puis soumettez votre dossier pour activer les paiements en production.
        </Banner>
      )
  }
}

function Banner({
  icon,
  tone,
  title,
  titleClass,
  bodyClass,
  children,
}: {
  icon: React.ReactNode
  tone: string
  title: string
  titleClass: string
  bodyClass: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${tone}`}>
      <div className="flex gap-3">
        <span className="mt-0.5 flex-shrink-0">{icon}</span>
        <div className="text-sm">
          <p className={`font-medium ${titleClass}`}>{title}</p>
          <p className={`mt-1 ${bodyClass}`}>{children}</p>
        </div>
      </div>
    </div>
  )
}
