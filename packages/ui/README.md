# @kajai/ui – KajAI design rendszer

Közös tokenek, Tailwind preset és alap komponensek (shadcn/ui mintára). A színek a
KajAI logóból jönnek (petrol + arany), a formák és a tipográfia az „Organic" rendszerből.

## Mi hol van

| Fájl | Mire való |
| --- | --- |
| `src/styles/tokens.css` | Szín-, tipográfia-, lekerekítés- és árnyéktokenek CSS változóként (világos + `.dark`), a betűtípusok betöltése |
| `tailwind-preset.ts` | A tokenek leképezése Tailwind osztályokra + alap elemstílusok (`body`, `h1`–`h6`) |
| `src/components/*` | Button, Input / Textarea / Select, Label / Field, Card, Badge, Dialog, ThemeToggle |
| `src/**/*.stories.tsx` | Storybook dokumentáció |

## Használat

```tsx
import { Button, Card, CardContent, Field, Input } from '@kajai/ui'

<Card>
  <CardContent className="flex flex-col gap-4">
    <Field label="Testtömeg (kg)" htmlFor="weight">
      <Input id="weight" type="number" />
    </Field>
    <Button block>Mentés</Button>
  </CardContent>
</Card>
```

Saját markupban a **szemantikus** osztályokat használd, ne a nyers Tailwind színeket –
ezek váltanak át maguktól sötét módban:

| Ehelyett | Ezt |
| --- | --- |
| `bg-white`, `bg-gray-50` | `bg-card`, `bg-background`, `bg-muted` |
| `text-gray-900`, `text-gray-500` | `text-foreground`, `text-muted-foreground` |
| `border-gray-300` | `border-border` |
| `bg-gray-900 text-white` (gomb) | `<Button>` |
| `text-red-600` | `text-destructive` |
| `rounded-lg`, `rounded-2xl` | `rounded-md` (16px), `rounded-card` (32px), `rounded-full` |

Betűméretek: `text-h1` … `text-h6`, `text-body`, `text-small`, `text-caption`.
Címsor-betű: `font-heading` (Caprasimo, csak 400-as súly – ne tegyél rá `font-bold`-ot).

## Sötét mód

A `<html>` elem `.dark` osztálya kapcsolja. A web appban a `next-themes` kezeli
(`apps/web/src/components/providers.tsx`), alapból a rendszerbeállítást követi, a
választás a böngészőben megmarad. Egyedi sötét stílus: `dark:` előtaggal.

## Storybook

```bash
pnpm storybook
```

A <http://localhost:6006> címen nyílik; a felső sávban váltható a világos/sötét téma.

## Új komponens

1. `src/components/<nev>.tsx` – a `cn()` segéddel és a tokenekre épülő osztályokkal.
   shadcn komponens átvételekor a színosztályok változtatás nélkül működnek
   (`bg-primary`, `text-muted-foreground`, …), a lekerekítést igazítsd a fenti skálához.
2. Exportáld a `src/index.ts`-ből.
3. Írj mellé `<nev>.stories.tsx`-t.
