import type { Config } from 'tailwindcss'
import kajaiPreset from '@kajai/ui/tailwind-preset'

// A színek, betűk, lekerekítések a közös presetből jönnek (packages/ui) –
// ide csak app-specifikus kiegészítés kerüljön.
const config: Config = {
  presets: [kajaiPreset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
