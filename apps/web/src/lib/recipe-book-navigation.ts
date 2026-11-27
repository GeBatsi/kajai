import { correctionAccess } from './correction-nutrition'
import { canManageFoods } from './food-permissions'

export type RecipeBookUser = Parameters<typeof correctionAccess>[0]
export type RecipeBookIcon = 'suggest' | 'list' | 'review' | 'ingredient' | 'edit'

const sections = [
  {
    id: 'suggestions',
    title: 'Javaslatok',
    description: 'Segíts pontosítani a tápértékeket, és kövesd a beküldéseidet.',
    items: [
      {
        id: 'submit',
        label: 'Tápérték-javítási javaslat',
        description: 'Válassz élelmiszert, és javasolj ellenőrizhető tápérték-javítást.',
        href: '/nutrition-corrections/new',
        icon: 'suggest',
      },
      {
        id: 'mine',
        label: 'Saját javaslataim',
        description: 'Nézd meg a beküldött javaslataidat és az elbírálás eredményét.',
        href: '/nutrition-corrections/mine',
        icon: 'list',
      },
      {
        id: 'moderation',
        label: 'Javaslatok moderálása',
        description: 'Hasonlítsd össze és bíráld el a közösség tápérték-javításait.',
        href: '/moderator/nutrition-corrections',
        icon: 'review',
        management: true,
      },
    ],
  },
  {
    id: 'ingredients',
    title: 'Alapanyagkezelés',
    description: 'Tartsd naprakészen az alapanyag-adatbázist.',
    items: [
      {
        id: 'create-food',
        label: 'Alapanyag létrehozása',
        description: 'Rögzíts új alapanyagot tápértékekkel és allergénadatokkal.',
        href: '/moderator/foods/new',
        icon: 'ingredient',
        management: true,
      },
      {
        id: 'edit-food',
        label: 'Alapanyag szerkesztése',
        description: 'Keress alapanyagot az adatok, képek és előzmények kezeléséhez.',
        href: '/moderator/foods/edit',
        icon: 'edit',
        management: true,
      },
    ],
  },
] as const satisfies readonly {
  id: string
  title: string
  description: string
  items: readonly {
    id: string
    label: string
    description: string
    href: string
    icon: RecipeBookIcon
    management?: boolean
  }[]
}[]

export function canAccessRecipeBook(user: RecipeBookUser): boolean {
  return correctionAccess(user)
}

export function recipeBookSections(user: RecipeBookUser) {
  if (!canAccessRecipeBook(user)) return []
  const management = canManageFoods(user?.role)
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !('management' in item && item.management) || management,
      ),
    }))
    .filter((section) => section.items.length > 0)
}

export function isRecipeBookPath(pathname: string | null): boolean {
  return [
    '/recipe-book',
    '/nutrition-corrections',
    '/moderator/nutrition-corrections',
    '/moderator/foods',
  ].some((path) => pathname === path || pathname?.startsWith(path + '/'))
}
