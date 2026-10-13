import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './badge'

const meta = {
  title: 'Komponensek/Badge',
  component: Badge,
  args: { children: '18 napos sor' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'neutral', 'outline', 'success', 'destructive'],
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>612 kcal</Badge>
      <Badge variant="secondary">1 240 Ft</Badge>
      <Badge variant="neutral">Laktózmentes</Badge>
      <Badge variant="outline">Vegán</Badge>
      <Badge variant="success">Kereten belül</Badge>
      <Badge variant="destructive">2 nap múlva lejár</Badge>
    </div>
  ),
}
