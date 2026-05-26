import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Authentification | Kadryza',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-slate-50 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center">
          <Image src="/logo-full.svg" alt="Kadryza" width={120} height={32} className="h-8 w-auto dark:hidden" />
          <Image src="/logo-dark.svg" alt="Kadryza" width={120} height={32} className="h-8 w-auto hidden dark:block" />
        </div>
        {children}
        <div className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Kadryza. Tous droits réservés.
        </div>
      </div>
    </div>
  )
}
