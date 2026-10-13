import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog'
import { Input } from './input'
import { Field } from './label'

const meta = {
  title: 'Komponensek/Dialog',
  component: Dialog,
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Súly rögzítése</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mai súlyod</DialogTitle>
          <DialogDescription>A trendvonalat ebből számoljuk, a napi keretet nem írja át.</DialogDescription>
        </DialogHeader>
        <Field label="Testtömeg (kg)" htmlFor="dialog-weight">
          <Input id="dialog-weight" type="number" defaultValue={72.4} />
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Mégse</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Mentés</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

export const Confirm: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Étkezés törlése</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Törlöd az ebédet?</DialogTitle>
          <DialogDescription>612 kcal és 1 240 Ft kerül vissza a mai keretedbe.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Megtartom</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive">Törlés</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
