'use client'

import { useRef, useState } from 'react'
import { FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useDeleteKYCDocument, useUploadKYCDocument } from '@/lib/hooks/useKYC'
import type { KYCDocument, KYCDocumentType } from '@/lib/types'
import {
  formatBytes,
  KYC_ACCEPTED_MIME,
  KYC_DOC_STATUS_DISPLAY,
  KYC_DOC_TYPE_LABELS,
  KYC_DOC_TYPE_OPTIONS,
  KYC_MAX_UPLOAD_BYTES,
} from './constants'

// =============================================================================
// Section documents — liste + upload (validation client) + suppression
// =============================================================================

export function DocumentsSection({
  documents,
  editable,
}: {
  documents: KYCDocument[]
  editable: boolean
}) {
  const upload = useUploadKYCDocument()
  const remove = useDeleteKYCDocument()

  const [docType, setDocType] = useState<KYCDocumentType | ''>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Réinitialise tout de suite pour pouvoir re-sélectionner le même fichier
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    if (!docType) {
      toast.error('Sélectionnez d’abord le type de document')
      return
    }
    if (file.size > KYC_MAX_UPLOAD_BYTES) {
      toast.error('Fichier trop volumineux (max 10 Mo)')
      return
    }
    if (file.type && !KYC_ACCEPTED_MIME.split(',').includes(file.type)) {
      toast.error('Format non supporté (JPEG, PNG, WebP ou PDF)')
      return
    }

    upload.mutate(
      { docType, file },
      { onSuccess: () => setDocType('') }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>
          Formats acceptés : JPEG, PNG, WebP, PDF — max 10 Mo par fichier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Liste des documents */}
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <FileText className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900">Aucun document</p>
            <p className="mt-1 text-sm text-slate-500">
              Ajoutez au moins une pièce d’identité pour soumettre votre dossier.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {documents.map((doc) => {
              const st = KYC_DOC_STATUS_DISPLAY[doc.status]
              return (
                <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="h-5 w-5 flex-shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {KYC_DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {doc.file_name ?? 'document'}
                      {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`inline-flex flex-shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${st.className}`}
                  >
                    {st.label}
                  </span>
                  {editable && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 text-slate-400 hover:text-red-600"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(doc.id)}
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* Zone d'upload */}
        {editable && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="doc_type">Type de document</Label>
                <Select
                  value={docType || undefined}
                  onValueChange={(v) => setDocType(v as KYCDocumentType)}
                  disabled={upload.isPending}
                >
                  <SelectTrigger id="doc_type">
                    <SelectValue placeholder="Sélectionner…" />
                  </SelectTrigger>
                  <SelectContent>
                    {KYC_DOC_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {KYC_DOC_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={KYC_ACCEPTED_MIME}
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!docType || upload.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {upload.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Choisir un fichier
              </Button>
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <Plus className="h-3 w-3" />
              Sélectionnez le type puis le fichier — l’upload démarre automatiquement.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
