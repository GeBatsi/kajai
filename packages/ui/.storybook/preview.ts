import type { Preview } from '@storybook/react-vite'
import { withThemeByClassName } from '@storybook/addon-themes'
import '../src/styles/tokens.css'
import './storybook.css'

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: { disable: true },
    controls: { matchers: { color: /(background|color)$/i } },
    options: {
      storySort: { order: ['Alapok', ['Színek', 'Tipográfia'], 'Komponensek'] },
    },
  },
  decorators: [
    // Ugyanaz a mechanizmus, mint az appban: `.dark` osztály a <html>-en.
    // A kulcsok ASCII-k maradnak: ékezetes értéket a Storybook kiszűr az URL-ből.
    withThemeByClassName({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
    }),
  ],
  tags: ['autodocs'],
}

export default preview
