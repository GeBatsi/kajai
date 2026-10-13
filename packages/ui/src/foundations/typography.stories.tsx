import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Alapok/Tipográfia',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const headings = [
  { cls: 'text-h1', label: 'text-h1 · 42px', sample: 'Ma 1 580 kcal' },
  { cls: 'text-h2', label: 'text-h2 · 32px', sample: 'Mennyibe kerül a döntésed' },
  { cls: 'text-h3', label: 'text-h3 · 25px', sample: 'Bevásárlólista boltra bontva' },
  { cls: 'text-h4', label: 'text-h4 · 20px', sample: 'Lejárat előtt álló tételek' },
  { cls: 'text-h5', label: 'text-h5 · 16px', sample: 'Csirkemell rizzsel' },
  { cls: 'text-h6 uppercase', label: 'text-h6 · 13px, nagybetűs', sample: 'Mai étkezések' },
]

const body = [
  { cls: 'text-body', label: 'text-body · 15px', sample: 'A számítás nem rejtőzik el: látod, miből áll a napi kereted.' },
  { cls: 'text-small', label: 'text-small · 13px', sample: 'Otthon főzve, 1 adag · 612 kcal' },
  { cls: 'text-caption', label: 'text-caption · 12px', sample: 'Utoljára frissítve: ma 12:40' },
]

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-baseline gap-1 border-b border-border py-4 sm:grid-cols-[220px_1fr] sm:gap-6">
      <p className="font-mono text-caption text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

/** Címsorok: Caprasimo (csak 400-as súly). A `<h1>`–`<h6>` elemek alapból ezt kapják. */
export const Headings: Story = {
  render: () => (
    <div>
      {headings.map((item) => (
        <Row key={item.cls} label={item.label}>
          <p className={`font-heading ${item.cls}`}>{item.sample}</p>
        </Row>
      ))}
    </div>
  ),
}

/** Folyószöveg: Figtree (változó súly, 300–900). */
export const Body: Story = {
  render: () => (
    <div>
      {body.map((item) => (
        <Row key={item.cls} label={item.label}>
          <p className={item.cls}>{item.sample}</p>
        </Row>
      ))}
      <Row label="súlyok">
        <p className="flex flex-wrap gap-x-6 gap-y-1 text-body">
          <span className="font-normal">400 Normál</span>
          <span className="font-medium">500 Közepes</span>
          <span className="font-semibold">600 Félkövér</span>
          <span className="font-bold">700 Kövér</span>
        </p>
      </Row>
    </div>
  ),
}
