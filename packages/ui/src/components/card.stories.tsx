import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './badge'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardKicker, CardTitle } from './card'

const meta = {
  title: 'Komponensek/Card',
  component: Card,
  argTypes: {
    elevation: { control: 'inline-radio', options: ['none', 'sm', 'md', 'lg'] },
    tone: { control: 'inline-radio', options: ['default', 'brand'] },
  },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardKicker>Ebéd · 12:40</CardKicker>
        <CardTitle>Csirkemell rizzsel</CardTitle>
        <CardDescription>Otthon főzve, 1 adag</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Badge>612 kcal</Badge>
        <Badge variant="secondary">1 240 Ft</Badge>
      </CardContent>
      <CardFooter>
        <Button size="sm">Újra rögzítem</Button>
        <Button size="sm" variant="ghost">
          Szerkesztés
        </Button>
      </CardFooter>
    </Card>
  ),
}

/** A főoldali "hero" kártya hangja: petrol felület, a számok címsor-betűvel. */
export const Brand: Story = {
  args: { tone: 'brand', elevation: 'md' },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardKicker>Szerda, május 14.</CardKicker>
        <CardTitle className="text-h2">1 580</CardTitle>
        <CardDescription>a 2 100 kcal napi keretből</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-3/4 rounded-full bg-teal-300" />
        </div>
      </CardContent>
    </Card>
  ),
}

export const Elevations: Story = {
  decorators: [(Story) => <div className="w-[640px]">{Story()}</div>],
  render: () => (
    <div className="grid grid-cols-4 gap-4">
      {(['none', 'sm', 'md', 'lg'] as const).map((elevation) => (
        <Card key={elevation} elevation={elevation}>
          <CardContent className="text-center text-small font-semibold">{elevation}</CardContent>
        </Card>
      ))}
    </div>
  ),
}
