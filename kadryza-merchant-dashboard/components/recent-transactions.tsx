"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Transaction {
  id: string
  reference: string
  montant: number
  operateur: "Airtel Money" | "Moov Money"
  statut: "succès" | "échec" | "en attente"
  date: string
  telephone: string
}

const transactions: Transaction[] = [
  {
    id: "1",
    reference: "TXN-2024-001",
    montant: 25000,
    operateur: "Airtel Money",
    statut: "succès",
    date: "23/05/2024 14:32",
    telephone: "+235 66 XX XX 12",
  },
  {
    id: "2",
    reference: "TXN-2024-002",
    montant: 150000,
    operateur: "Moov Money",
    statut: "succès",
    date: "23/05/2024 14:28",
    telephone: "+235 68 XX XX 45",
  },
  {
    id: "3",
    reference: "TXN-2024-003",
    montant: 75000,
    operateur: "Airtel Money",
    statut: "en attente",
    date: "23/05/2024 14:25",
    telephone: "+235 66 XX XX 78",
  },
  {
    id: "4",
    reference: "TXN-2024-004",
    montant: 50000,
    operateur: "Moov Money",
    statut: "échec",
    date: "23/05/2024 14:20",
    telephone: "+235 69 XX XX 33",
  },
  {
    id: "5",
    reference: "TXN-2024-005",
    montant: 200000,
    operateur: "Airtel Money",
    statut: "succès",
    date: "23/05/2024 14:15",
    telephone: "+235 66 XX XX 91",
  },
]

function formatXAF(value: number): string {
  return value.toLocaleString('fr-FR') + ' XAF'
}

function getStatusBadge(statut: Transaction["statut"]) {
  const styles = {
    "succès": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    "échec": "bg-red-100 text-red-700 hover:bg-red-100",
    "en attente": "bg-amber-100 text-amber-700 hover:bg-amber-100",
  }
  
  const labels = {
    "succès": "Succès",
    "échec": "Échec",
    "en attente": "En attente",
  }
  
  return (
    <Badge variant="secondary" className={cn("font-medium", styles[statut])}>
      {labels[statut]}
    </Badge>
  )
}

export function RecentTransactions() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-card-foreground">
          Transactions récentes
        </CardTitle>
        <a href="/transactions" className="text-sm font-medium text-primary hover:underline">
          Voir tout
        </a>
      </CardHeader>
      <CardContent className="px-0">
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
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs text-foreground">{tx.reference}</td>
                  <td className="px-6 py-3 font-semibold text-foreground">{formatXAF(tx.montant)}</td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5",
                      tx.operateur === "Airtel Money" ? "text-primary" : "text-blue-600"
                    )}>
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        tx.operateur === "Airtel Money" ? "bg-primary" : "bg-blue-600"
                      )} />
                      {tx.operateur}
                    </span>
                  </td>
                  <td className="px-6 py-3">{getStatusBadge(tx.statut)}</td>
                  <td className="px-6 py-3 text-muted-foreground">{tx.telephone}</td>
                  <td className="px-6 py-3 text-muted-foreground">{tx.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
