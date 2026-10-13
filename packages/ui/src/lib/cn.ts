import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// A saját betűméret-osztályainkat (text-h1 … text-caption) be kell jelenteni,
// különben a tailwind-merge színnek nézi őket, és kiüti a `text-primary` mellől.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'small', 'caption'] }],
      rounded: [{ rounded: ['card'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
