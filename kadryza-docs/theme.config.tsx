import type { DocsThemeConfig } from 'nextra-theme-docs'
import { useRouter } from 'next/router'

const config: DocsThemeConfig = {
  logo: (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
      <span style={{ fontSize: '1.4em' }}>⚡</span>
      <span style={{
        background: 'linear-gradient(135deg, #F97316, #EA580C)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontSize: '1.15em',
        letterSpacing: '-0.02em'
      }}>
        Kadryza
      </span>
    </span>
  ),
  project: {
    link: 'https://github.com/kadryza'
  },
  docsRepositoryBase: 'https://github.com/kadryza/kadryza-docs/blob/main',
  footer: {
    text: (
      <span style={{ fontSize: '0.85em', color: '#888' }}>
        © {new Date().getFullYear()} Kadryza — Infrastructure de paiement Mobile Money pour le Tchad et la zone CEMAC
      </span>
    )
  },
  primaryHue: 24,
  primarySaturation: 95,
  navigation: true,
  search: {
    placeholder: 'Rechercher dans la documentation...'
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  toc: {
    title: 'Sur cette page',
    backToTop: true
  },
  editLink: {
    text: 'Modifier cette page sur GitHub →'
  },
  feedback: {
    content: 'Signaler un problème →',
    labels: 'feedback'
  },
  head: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { asPath } = useRouter()
    const isHome = asPath === '/'
    const title = isHome
      ? 'Documentation Kadryza — API de paiement Mobile Money'
      : 'Kadryza Docs'

    return (
      <>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="description"
          content="Documentation Kadryza — API et SDK de paiement Mobile Money pour le Tchad et la zone CEMAC. Airtel Money, Moov Money."
        />
        <meta name="og:title" content={title} />
        <meta
          name="og:description"
          content="Intégrez les paiements Mobile Money en moins de 15 minutes avec Kadryza."
        />
        <meta name="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </>
    )
  },
  useNextSeoProps() {
    const { asPath } = useRouter()
    if (asPath !== '/') {
      return {
        titleTemplate: '%s — Kadryza Docs'
      }
    }
    return {
      title: 'Documentation Kadryza — API de paiement Mobile Money'
    }
  },
  banner: {
    key: 'kadryza-beta',
    text: (
      <span>
        🚀 Kadryza est en version bêta.{' '}
        <a
          href="https://dashboard.kadryza.app/register"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'underline' }}
        >
          Créez votre compte gratuitement →
        </a>
      </span>
    )
  }
}

export default config
