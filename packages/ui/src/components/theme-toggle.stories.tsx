import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ThemeToggle } from './theme-toggle'

const meta = {
  title: 'Komponensek/ThemeToggle',
  component: ThemeToggle,
  args: { theme: 'light', onThemeChange: () => {} },
  argTypes: { theme: { control: 'inline-radio', options: ['light', 'dark'] } },
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof meta>

/** Az appban a next-themes adja a témát; itt helyi állapot helyettesíti. */
export const Default: Story = {
  render: function Render(args) {
    const [theme, setTheme] = useState(args.theme)
    return <ThemeToggle theme={theme} onThemeChange={setTheme} />
  },
}

export const Dark: Story = { args: { theme: 'dark' } }
