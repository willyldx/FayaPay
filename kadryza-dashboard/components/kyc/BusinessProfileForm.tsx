'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUpdateKYCProfile } from '@/lib/hooks/useKYC'
import type { BusinessType, KYCStatusResponse, UpdateKYCProfileRequest } from '@/lib/types'
import { BUSINESS_TYPE_LABELS } from './constants'

// =============================================================================
// Formulaire du profil business (raison sociale, RCCM, NIF, contact, adresse)
// =============================================================================

export function BusinessProfileForm({
  kyc,
  readOnly,
}: {
  kyc: KYCStatusResponse
  readOnly: boolean
}) {
  const update = useUpdateKYCProfile()

  const [businessType, setBusinessType] = useState<BusinessType | ''>(kyc.business_type ?? '')
  const [legalName, setLegalName] = useState(kyc.legal_name ?? '')
  const [rccm, setRccm] = useState(kyc.rccm ?? '')
  const [nif, setNif] = useState(kyc.nif ?? '')
  const [contactPhone, setContactPhone] = useState(kyc.contact_phone ?? '')
  const [address, setAddress] = useState(kyc.address ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return

    const body: UpdateKYCProfileRequest = {
      business_type: businessType || undefined,
      legal_name: legalName.trim() || undefined,
      rccm: rccm.trim() || undefined,
      nif: nif.trim() || undefined,
      contact_phone: contactPhone.trim() || undefined,
      address: address.trim() || undefined,
    }
    update.mutate(body)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil business</CardTitle>
        <CardDescription>
          Ces informations doivent correspondre à vos documents officiels.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Type d'entité */}
            <div className="space-y-1.5">
              <Label htmlFor="business_type">
                Type d’entité <span className="text-red-500">*</span>
              </Label>
              <Select
                value={businessType || undefined}
                onValueChange={(v) => setBusinessType(v as BusinessType)}
                disabled={readOnly}
              >
                <SelectTrigger id="business_type">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {BUSINESS_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Raison sociale / nom légal */}
            <div className="space-y-1.5">
              <Label htmlFor="legal_name">
                Raison sociale / nom légal <span className="text-red-500">*</span>
              </Label>
              <Input
                id="legal_name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Nom légal complet"
                maxLength={255}
                disabled={readOnly}
              />
            </div>

            {/* RCCM */}
            <div className="space-y-1.5">
              <Label htmlFor="rccm">RCCM (Registre du commerce)</Label>
              <Input
                id="rccm"
                value={rccm}
                onChange={(e) => setRccm(e.target.value)}
                placeholder="N° RCCM"
                maxLength={100}
                disabled={readOnly}
              />
            </div>

            {/* NIF */}
            <div className="space-y-1.5">
              <Label htmlFor="nif">NIF (Identification fiscale)</Label>
              <Input
                id="nif"
                value={nif}
                onChange={(e) => setNif(e.target.value)}
                placeholder="N° NIF"
                maxLength={100}
                disabled={readOnly}
              />
            </div>

            {/* Téléphone de contact */}
            <div className="space-y-1.5">
              <Label htmlFor="contact_phone">Téléphone de contact</Label>
              <Input
                id="contact_phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+235 ..."
                maxLength={20}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Adresse */}
          <div className="space-y-1.5">
            <Label htmlFor="address">Adresse</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Adresse complète (rue, ville, pays)"
              maxLength={500}
              rows={2}
              disabled={readOnly}
            />
          </div>

          {!readOnly && (
            <div className="flex justify-end">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer le profil
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
