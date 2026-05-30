'use client'

import {
  Mail,
  Clock,
  BookOpen,
  ExternalLink,
  HelpCircle,
  LifeBuoy,
} from 'lucide-react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

// =============================================================================
// Page Support & Aide — /support
// =============================================================================

const SUPPORT_EMAIL = 'support@kadryza.app'
const DOCS_URL = 'https://docs.kadryza.spencerai.tech'

const faq = [
  {
    q: 'Comment obtenir une clé API ?',
    a: 'Allez dans API Keys → Créer une clé. La clé s\'affiche une seule fois, conservez-la précieusement.',
  },
  {
    q: 'Quels opérateurs sont supportés ?',
    a: 'Airtel Money et Moov Money (Tchad). D\'autres opérateurs seront ajoutés prochainement.',
  },
  {
    q: 'Que faire si une transaction reste en PENDING ?',
    a: 'Les transactions expirent après 5 minutes. Vérifiez que le gateway est connecté dans votre dashboard.',
  },
  {
    q: 'Comment tester sans gateway physique ?',
    a: 'En mode test, les transactions passent en TIMEOUT après 5 minutes. Le gateway Android est nécessaire pour les vraies transactions.',
  },
  {
    q: 'Comment vérifier mon email ?',
    a: 'Un email de vérification a été envoyé à votre inscription. Vérifiez vos spams si vous ne le trouvez pas. Vous pouvez le renvoyer depuis la bannière en haut du dashboard.',
  },
]

export default function SupportPage() {
  return (
    <div className="max-w-3xl space-y-8 animate-in">
      {/* A. Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Support &amp; Aide</h1>
        <p className="mt-1 text-sm text-slate-500">
          Notre équipe est là pour vous aider
        </p>
      </div>

      {/* B & C — Contact + Documentation */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* B. Nous contacter */}
        <section className="card flex flex-col p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-kadryza-50">
            <Mail className="h-5 w-5 text-kadryza-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Nous contacter</h2>
          <p className="mt-1 text-sm text-slate-500">
            Une question ? Écrivez-nous directement.
          </p>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="h-4 w-4 text-slate-400" />
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-kadryza-600 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-4 w-4 text-slate-400" />
              <span>Sous 24h en jours ouvrables</span>
            </div>
          </dl>

          <a href={`mailto:${SUPPORT_EMAIL}`} className="btn-primary mt-6 w-full">
            <Mail className="h-4 w-4" />
            Envoyer un email
          </a>
        </section>

        {/* C. Documentation */}
        <section className="card flex flex-col p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-kadryza-50">
            <BookOpen className="h-5 w-5 text-kadryza-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Documentation</h2>
          <p className="mt-1 text-sm text-slate-500">
            Consultez notre documentation pour intégrer Kadryza rapidement.
          </p>

          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary mt-auto w-full"
          >
            <ExternalLink className="h-4 w-4" />
            Voir la documentation
          </a>
        </section>
      </div>

      {/* D. FAQ */}
      <section className="card p-6">
        <div className="mb-2 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-kadryza-600" />
          <h2 className="text-lg font-semibold text-slate-900">
            Questions fréquentes
          </h2>
        </div>
        <p className="mb-2 text-sm text-slate-500">
          Les réponses aux questions les plus courantes.
        </p>

        <Accordion type="single" collapsible className="w-full">
          {faq.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-slate-200">
              <AccordionTrigger className="text-slate-900 hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-slate-600 leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Footer note */}
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        <LifeBuoy className="h-4 w-4 flex-shrink-0 text-slate-400" />
        <span>
          Vous ne trouvez pas votre réponse ?{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-kadryza-600 hover:underline"
          >
            Contactez le support
          </a>
          .
        </span>
      </div>
    </div>
  )
}
