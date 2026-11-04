import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input, Select, Textarea } from './input'
import { Field } from './label'

const meta = {
  title: 'Komponensek/Input',
  component: Input,
  args: { placeholder: 'pl. túró rudi', 'aria-label': 'Étel keresése' },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = { args: { disabled: true, value: '72' } }

/** A `Field` adja a címkét és a segéd- vagy hibaszöveget. */
export const WithField: Story = {
  render: () => (
    <Field label="Testtömeg (kg)" htmlFor="weight" hint="Reggel, étkezés előtt mért érték.">
      <Input id="weight" type="number" defaultValue={72} />
    </Field>
  ),
}

export const WithError: Story = {
  render: () => (
    <Field label="Születési dátum" htmlFor="dob" error="A születési dátum nem lehet jövőbeli.">
      <Input id="dob" type="date" defaultValue="2031-05-14" aria-invalid="true" />
    </Field>
  ),
}

export const SelectField: Story = {
  render: () => (
    <Field label="Cél" htmlFor="goal">
      <Select id="goal" defaultValue="MAINTENANCE">
        <option value="WEIGHT_LOSS">Fogyás</option>
        <option value="MAINTENANCE">Súlytartás</option>
        <option value="MUSCLE_GAIN">Izomépítés</option>
      </Select>
    </Field>
  ),
}

export const TextareaField: Story = {
  render: () => (
    <Field label="Megjegyzés" htmlFor="note">
      <Textarea id="note" placeholder="Hogy esett az ebéd?" />
    </Field>
  ),
}
