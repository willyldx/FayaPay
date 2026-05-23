"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Gateway {
  name: string
  status: "opérationnel" | "dégradé" | "hors ligne"
  latency?: string
}

const gateways: Gateway[] = [
  { name: "Airtel Money API", status: "opérationnel", latency: "120ms" },
  { name: "Moov Money API", status: "opérationnel", latency: "145ms" },
]

export function GatewayStatus() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-card-foreground">
          État des passerelles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {gateways.map((gateway) => (
          <div 
            key={gateway.name} 
            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-2.5 w-2.5 rounded-full",
                gateway.status === "opérationnel" && "bg-emerald-500",
                gateway.status === "dégradé" && "bg-amber-500",
                gateway.status === "hors ligne" && "bg-red-500"
              )} />
              <span className="font-medium text-foreground">{gateway.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {gateway.latency && (
                <span className="text-sm text-muted-foreground">{gateway.latency}</span>
              )}
              <span className={cn(
                "text-sm font-medium capitalize",
                gateway.status === "opérationnel" && "text-emerald-600",
                gateway.status === "dégradé" && "text-amber-600",
                gateway.status === "hors ligne" && "text-red-600"
              )}>
                {gateway.status}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
