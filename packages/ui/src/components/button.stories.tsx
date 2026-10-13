import type { Meta, StoryObj } from '@storybook/react-vite'
import { Plus, ScanBarcode } from 'lucide-react'
import { Button } from './button'

const meta = {
  title: 'Komponensek/Button',
  component: Button,
  args: { children: 'Étkezés rögzítése' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'icon'] },
    block: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Mentés</Button>
      <Button variant="secondary">Hozzáadás a listához</Button>
      <Button variant="outline">Mégse</Button>
      <Button variant="ghost">Kihagyom</Button>
      <Button variant="destructive">Törlés</Button>
      <Button variant="link">Részletek</Button>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Kicsi</Button>
      <Button size="md">Közepes</Button>
      <Button size="lg">Nagy</Button>
      <Button size="icon" aria-label="Új étkezés">
        <Plus />
      </Button>
    </div>
  ),
}

export const WithIcon: Story = {
  render: () => (
    <Button variant="secondary">
      <ScanBarcode />
      Vonalkód beolvasása
    </Button>
  ),
}

export const Disabled: Story = { args: { disabled: true } }

export const Block: Story = {
  args: { block: true, children: 'Tovább' },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
}

/** `asChild`-dal a gomb stílusa linkre (pl. Next `<Link>`) kerül. */
export const AsLink: Story = {
  render: () => (
    <Button asChild variant="outline">
      <a href="#profil">Profil megnyitása</a>
    </Button>
  ),
}
