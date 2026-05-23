"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string
  change?: {
    value: string
    trend: "up" | "down" | "neutral"
  }
  subtitle?: string
  icon?: React.ReactNode
}

export function MetricCard({ title, value, change, subtitle, icon }: MetricCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-card-foreground">{value}</div>
        {change && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            {change.trend === "up" && (
              <TrendingUp className="h-3 w-3 text-emerald-600" />
            )}
            {change.trend === "down" && (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            {change.trend === "neutral" && (
              <Minus className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={cn(
              "font-medium",
              change.trend === "up" && "text-emerald-600",
              change.trend === "down" && "text-red-500",
              change.trend === "neutral" && "text-muted-foreground"
            )}>
              {change.value}
            </span>
            <span className="text-muted-foreground">vs semaine dernière</span>
          </div>
        )}
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
