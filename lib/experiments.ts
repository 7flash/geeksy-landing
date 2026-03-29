export type HeroAction =
  | { type: 'connect' }
  | { type: 'spin' }
  | { type: 'link'; href: string }

export type HeroVariant = {
  id: string
  badge: string
  title: string
  titleAccent: string
  subheadline: string
  primaryCta: { label: string; action: HeroAction }
  secondaryCta: { label: string; action: HeroAction }
  navCta: { label: string; href: string }
}

export type LandingExperiment = {
  id: string
  queryParam: string
  storageKey: string
  cookieName: string
  defaultVariant: string
  variants: Record<string, HeroVariant>
}

export const heroCtaExperiment: LandingExperiment = {
  id: 'hero-cta-v1',
  queryParam: 'exp-hero-cta',
  storageKey: 'geeksy-exp:hero-cta-v1',
  cookieName: 'geeksy_exp_hero_cta_v1',
  defaultVariant: 'control',
  variants: {
    control: {
      id: 'control',
      badge: 'Hold GKSY · Earn Gravity · Win SOL',
      title: 'Hold GKSY.',
      titleAccent: 'Win SOL.',
      subheadline: 'Every minute you hold GKSY tokens, you earn gravity. Connect your Phantom wallet and spin the cosmic wheel to burn all your gravity into stardust and win SOL from the treasury. The more gravity you have relative to other holders, the better your odds.',
      primaryCta: { label: 'Connect Phantom', action: { type: 'connect' } },
      secondaryCta: { label: '🎰 Spin the Wheel', action: { type: 'spin' } },
      navCta: { label: 'Open App →', href: 'https://app.geeksy.xyz' },
    },
    wallet_first: {
      id: 'wallet_first',
      badge: 'Wallet-first Solana game · Signed spins · Real treasury rewards',
      title: 'Connect Phantom.',
      titleAccent: 'Burn Gravity.',
      subheadline: 'Geeksy turns held GKSY into live gravity, then lets you sign a real wallet challenge to burn that gravity into stardust and compete for SOL from the treasury.',
      primaryCta: { label: '🎰 Spin the Wheel', action: { type: 'spin' } },
      secondaryCta: { label: 'Connect Phantom', action: { type: 'connect' } },
      navCta: { label: 'Launch Wallet Flow →', href: '#gravity-story' },
    },
    proof_first: {
      id: 'proof_first',
      badge: 'Live leaderboard · Signed claims · On-chain reward game',
      title: 'Earn Gravity.',
      titleAccent: 'Claim Real SOL.',
      subheadline: 'Hold GKSY, climb the stardust leaderboard, and use signed Phantom messages to spin for treasury-funded SOL rewards. No fake points — your gravity is earned from live balances and market price.',
      primaryCta: { label: 'View Live Leaderboard', action: { type: 'link', href: '#gravity-story' } },
      secondaryCta: { label: 'Connect Phantom', action: { type: 'connect' } },
      navCta: { label: 'See Live Gravity →', href: '#gravity-story' },
    },
  },
}

export const landingExperiments = {
  heroCta: heroCtaExperiment,
}

export function getDefaultLandingExperimentPayload() {
  const variant = heroCtaExperiment.variants[heroCtaExperiment.defaultVariant] || heroCtaExperiment.variants.control
  return {
    heroCtaExperiment,
    initial: {
      heroCtaVariant: variant,
    },
  }
}

export function isHeroVariantId(value: string | null | undefined): value is keyof typeof heroCtaExperiment.variants {
  return !!value && value in heroCtaExperiment.variants
}
