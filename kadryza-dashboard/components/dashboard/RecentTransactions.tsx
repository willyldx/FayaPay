"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { Transaction } from "@/lib/types"
import { formatAmount, formatDateRelative, formatPhone } from "@/lib/utils/format"
import { Skeleton } from "@/components/ui/skeleton"

// =============================================================================
// RecentTransactions (New v0 Design)
// =============================================================================

interface RecentTransactionsProps {
  transactions: Transaction[]
  isLoading: boolean
}

function getStatusBadge(status: Transaction["status"]) {
  const styles: Record<string, string> = {
    "SUCCESS": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    "FAILED": "bg-red-100 text-red-700 hover:bg-red-100",
    "PENDING": "bg-amber-100 text-amber-700 hover:bg-amber-100",
    "PROCESSING": "bg-blue-100 text-blue-700 hover:bg-blue-100",
    "WAITING_FOR_CLIENT": "bg-purple-100 text-purple-700 hover:bg-purple-100",
    "TIMEOUT": "bg-gray-100 text-gray-700 hover:bg-gray-100",
    "REFUNDED": "bg-orange-100 text-orange-700 hover:bg-orange-100",
  }
  
  const labels: Record<string, string> = {
    "SUCCESS": "Succès",
    "FAILED": "Échec",
    "PENDING": "En attente",
    "PROCESSING": "En cours",
    "WAITING_FOR_CLIENT": "Attente client",
    "TIMEOUT": "Expiré",
    "REFUNDED": "Remboursé",
  }
  
  const style = styles[status] || "bg-gray-100 text-gray-700"
  const label = labels[status] || status

  return (
    <Badge variant="secondary" className={cn("font-medium", style)}>
      {label}
    </Badge>
  )
}

export function RecentTransactions({ transactions, isLoading }: RecentTransactionsProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-card-foreground">
          Transactions récentes
        </CardTitle>
        <Link href="/transactions" className="text-sm font-medium text-primary hover:underline">
          Voir tout
        </Link>
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="px-6 space-y-4 pb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="hidden sm:block h-4 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="hidden md:block h-4 w-20 ml-auto" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Aucune transaction récente
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 pb-3 text-left font-medium text-muted-foreground">Référence</th>
                  <th className="px-6 pb-3 text-left font-medium text-muted-foreground">Montant</th>
                  <th className="px-6 pb-3 text-left font-medium text-muted-foreground">Opérateur</th>
                  <th className="px-6 pb-3 text-left font-medium text-muted-foreground">Statut</th>
                  <th className="px-6 pb-3 text-left font-medium text-muted-foreground">Téléphone</th>
                  <th className="px-6 pb-3 text-left font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <tr 
                    key={tx.id} 
                    className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors opacity-0 animate-fade-in-up"
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                  >
                    <td className="px-6 py-3 font-mono text-xs text-foreground">
                      <Link href={`/transactions/${tx.id}`} className="hover:text-primary transition-colors">
                        {tx.reference}
                      </Link>
                    </td>
                    <td className="px-6 py-3 font-semibold text-foreground">{formatAmount(tx.amount)}</td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 font-medium",
                        tx.operator === "AIRTEL" ? "text-[#F97316]" : "text-[#3B82F6]"
                      )}>
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          tx.operator === "AIRTEL" ? "bg-[#F97316]" : "bg-[#3B82F6]"
                        )} />
                        {tx.operator === "AIRTEL" ? "Airtel Money" : "Moov Money"}
                      </span>
                    </td>
                    <td className="px-6 py-3">{getStatusBadge(tx.status)}</td>
                    <td className="px-6 py-3 text-muted-foreground font-mono">{formatPhone(tx.phone_number)}</td>
                    <td className="px-6 py-3 text-muted-foreground">{formatDateRelative(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
