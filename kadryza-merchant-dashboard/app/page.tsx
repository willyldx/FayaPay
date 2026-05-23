import { Sidebar } from "@/components/sidebar"
import { MetricCard } from "@/components/metric-card"
import { VolumeChart } from "@/components/volume-chart"
import { ProviderChart } from "@/components/provider-chart"
import { RecentTransactions } from "@/components/recent-transactions"
import { GatewayStatus } from "@/components/gateway-status"
import { 
  Wallet, 
  ArrowRightLeft, 
  CheckCircle2, 
  CalendarDays 
} from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <main className="flex-1 pl-64">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">
              Vue d&apos;ensemble
            </h1>
            <p className="text-muted-foreground">
              Bienvenue sur votre tableau de bord Kadryza
            </p>
          </div>

          {/* Metric Cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Volume Total"
              value="20.850.000 XAF"
              change={{ value: "+12.5%", trend: "up" }}
              icon={<Wallet className="h-5 w-5" />}
            />
            <MetricCard
              title="Transactions"
              value="1,247"
              change={{ value: "+8.2%", trend: "up" }}
              icon={<ArrowRightLeft className="h-5 w-5" />}
            />
            <MetricCard
              title="Taux de Succès"
              value="98.4%"
              change={{ value: "+0.3%", trend: "up" }}
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <MetricCard
              title="Aujourd'hui"
              value="1.250.000 XAF"
              subtitle="127 transactions"
              icon={<CalendarDays className="h-5 w-5" />}
            />
          </div>

          {/* Charts Row */}
          <div className="mb-8 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <VolumeChart />
            </div>
            <div>
              <ProviderChart />
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RecentTransactions />
            </div>
            <div>
              <GatewayStatus />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
