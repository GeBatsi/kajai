import type { Config } from 'tailwindcss'
import kajaiPreset from './tailwind-preset'

// Csak a Storybook használja; az appok a saját tailwind.config-jukban húzzák be a presetet.
const config: Config = {
  presets: [kajaiPreset],
  content: ['./src/**/*.{ts,tsx,mdx}', './.storybook/**/*.{ts,tsx}'],
}

export default config
