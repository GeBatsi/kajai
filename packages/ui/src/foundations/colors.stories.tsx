import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Alapok/Színek',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const semantic: { name: string; use: string; bg: string; fg: string }[] = [
  { name: 'background', use: 'Oldal háttér', bg: 'bg-background', fg: 'text-foreground' },
  { name: 'card', use: 'Kártyák', bg: 'bg-card', fg: 'text-card-foreground' },
  { name: 'popover', use: 'Dialog, lebegő felület', bg: 'bg-popover', fg: 'text-popover-foreground' },
  { name: 'primary', use: 'Fő művelet', bg: 'bg-primary', fg: 'text-primary-foreground' },
  { name: 'secondary', use: 'Másodlagos / ár', bg: 'bg-secondary', fg: 'text-secondary-foreground' },
  { name: 'muted', use: 'Mező, halk felület', bg: 'bg-muted', fg: 'text-muted-foreground' },
  { name: 'accent', use: 'Hover, kiemelés', bg: 'bg-accent', fg: 'text-accent-foreground' },
  { name: 'success', use: 'Kereten belül', bg: 'bg-success', fg: 'text-success-foreground' },
  { name: 'destructive', use: 'Hiba, törlés', bg: 'bg-destructive', fg: 'text-destructive-foreground' },
]

// A Tailwind csak a forrásban szó szerint szereplő osztályokat generálja le.
const scales: { name: string; steps: { step: number; bg: string }[] }[] = [
  {
    name: 'teal',
    steps: [
      { step: 50, bg: 'bg-teal-50' },
      { step: 100, bg: 'bg-teal-100' },
      { step: 300, bg: 'bg-teal-300' },
      { step: 400, bg: 'bg-teal-400' },
      { step: 500, bg: 'bg-teal-500' },
      { step: 700, bg: 'bg-teal-700' },
      { step: 900, bg: 'bg-teal-900' },
    ],
  },
  {
    name: 'amber',
    steps: [
      { step: 100, bg: 'bg-amber-100' },
      { step: 500, bg: 'bg-amber-500' },
      { step: 700, bg: 'bg-amber-700' },
      { step: 900, bg: 'bg-amber-900' },
    ],
  },
  {
    name: 'neutral',
    steps: [
      { step: 100, bg: 'bg-neutral-100' },
      { step: 200, bg: 'bg-neutral-200' },
      { step: 300, bg: 'bg-neutral-300' },
      { step: 400, bg: 'bg-neutral-400' },
      { step: 500, bg: 'bg-neutral-500' },
      { step: 600, bg: 'bg-neutral-600' },
      { step: 700, bg: 'bg-neutral-700' },
      { step: 800, bg: 'bg-neutral-800' },
      { step: 900, bg: 'bg-neutral-900' },
    ],
  },
]

/** Ezeket használd a képernyőkön – sötét módban maguktól átváltanak. */
export const Semantic: Story = {
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {semantic.map((token) => (
        <div key={token.name} className={`rounded-md border border-border p-4 ${token.bg} ${token.fg}`}>
          <p className="font-heading text-h5">{token.name}</p>
          <p className="text-caption opacity-80">{token.use}</p>
          <p className="mt-3 font-mono text-caption opacity-80">{token.bg}</p>
        </div>
      ))}
    </div>
  ),
}

/** A logó petrolja és aranya, plusz a meleg semleges skála. Mindkét módban azonosak. */
export const BrandScales: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {scales.map((scale) => (
        <div key={scale.name}>
          <h3 className="mb-2 text-h5">{scale.name}</h3>
          <div className="flex overflow-hidden rounded-md border border-border">
            {scale.steps.map(({ step, bg }) => (
              <div key={step} className="flex-1">
                <div className={`h-14 ${bg}`} />
                <p className="bg-card py-1.5 text-center font-mono text-caption text-card-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
}
