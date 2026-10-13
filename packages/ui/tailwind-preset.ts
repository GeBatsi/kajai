import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import animate from 'tailwindcss-animate'

// A tokenek a `src/styles/tokens.css`-ben élnek; ez a preset csak Tailwind
// osztályokra képezi le őket, hogy minden app ugyanazt a skálát használja.
const color = (token: string) => `rgb(var(--${token}) / <alpha-value>)`

const scale = (name: string, steps: number[]) =>
  Object.fromEntries(steps.map((step) => [step, color(`${name}-${step}`)]))

const preset = {
  darkMode: 'class',
  content: [],
  theme: {
    extend: {
      colors: {
        background: color('background'),
        foreground: color('foreground'),
        card: { DEFAULT: color('card'), foreground: color('card-foreground') },
        popover: { DEFAULT: color('popover'), foreground: color('popover-foreground') },
        primary: {
          DEFAULT: color('primary'),
          hover: color('primary-hover'),
          foreground: color('primary-foreground'),
        },
        secondary: {
          DEFAULT: color('secondary'),
          hover: color('secondary-hover'),
          foreground: color('secondary-foreground'),
        },
        muted: { DEFAULT: color('muted'), foreground: color('muted-foreground') },
        accent: { DEFAULT: color('accent'), foreground: color('accent-foreground') },
        destructive: { DEFAULT: color('destructive'), foreground: color('destructive-foreground') },
        success: { DEFAULT: color('success'), foreground: color('success-foreground') },
        border: color('border'),
        input: color('input'),
        ring: color('ring'),
        teal: scale('teal', [50, 100, 300, 400, 500, 700, 900]),
        amber: scale('amber', [100, 500, 700, 900]),
        neutral: scale('neutral', [100, 200, 300, 400, 500, 600, 700, 800, 900]),
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
        sans: ['var(--font-body)'],
      },
      fontSize: {
        h1: ['var(--text-h1)', { lineHeight: 'var(--leading-heading)', letterSpacing: 'var(--tracking-heading)' }],
        h2: ['var(--text-h2)', { lineHeight: 'var(--leading-heading)', letterSpacing: 'var(--tracking-heading)' }],
        h3: ['var(--text-h3)', { lineHeight: 'var(--leading-heading)', letterSpacing: 'var(--tracking-heading)' }],
        h4: ['var(--text-h4)', { lineHeight: 'var(--leading-heading)', letterSpacing: 'var(--tracking-heading)' }],
        h5: ['var(--text-h5)', { lineHeight: 'var(--leading-heading)', letterSpacing: 'var(--tracking-heading)' }],
        h6: ['var(--text-h6)', { lineHeight: 'var(--leading-heading)', letterSpacing: '0.08em' }],
        body: ['var(--text-body)', { lineHeight: 'var(--leading-body)' }],
        small: ['var(--text-small)', { lineHeight: '1.4' }],
        caption: ['var(--text-caption)', { lineHeight: '1.4' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        card: 'var(--radius-card)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [
    animate,
    plugin(({ addBase }) => {
      addBase({
        body: {
          backgroundColor: 'rgb(var(--background))',
          color: 'rgb(var(--foreground))',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-body)',
          lineHeight: 'var(--leading-body)',
        },
        'h1, h2, h3, h4, h5, h6': {
          fontFamily: 'var(--font-heading)',
          fontWeight: '400',
          lineHeight: 'var(--leading-heading)',
          letterSpacing: 'var(--tracking-heading)',
          // A Caprasimo csak 400-as súlyban létezik – ne hamisítson félkövért a böngésző.
          fontSynthesisWeight: 'none',
          textWrap: 'balance',
        },
        h1: { fontSize: 'var(--text-h1)' },
        h2: { fontSize: 'var(--text-h2)' },
        h3: { fontSize: 'var(--text-h3)' },
        h4: { fontSize: 'var(--text-h4)' },
        h5: { fontSize: 'var(--text-h5)' },
        h6: { fontSize: 'var(--text-h6)', letterSpacing: '0.08em', textTransform: 'uppercase' },
      })
    }),
  ],
} satisfies Config

export default preset
