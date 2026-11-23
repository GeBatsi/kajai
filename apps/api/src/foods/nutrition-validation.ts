import { BadRequestException } from '@nestjs/common'
import { Prisma } from '@kajai/db'

export function validateNutrition(nutrition?: Record<string, unknown> | null): void {
  if (!nutrition) {
    return
  }

  const amount = (field: string): number | null => {
    const value = nutrition[field]
    if (value == null) return null

    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException('A tápanyagmennyiségek csak nemnegatív, véges számok lehetnek.')
    }

    if (field !== 'energyKcal' && value > 100) {
      throw new BadRequestException('Egy tápanyag mennyisége legfeljebb 100 g lehet.')
    }
    return value
  }

  const energyKcal = amount('energyKcal')
  if (energyKcal !== null && energyKcal > 900) {
    throw new BadRequestException('Az energia mennyisége legfeljebb 900 kcal lehet.')
  }
  const protein = amount('protein')
  const carbs = amount('carbs')
  const fat = amount('fat')
  const fiber = amount('fiber')
  const salt = amount('salt')
  const sugar = amount('sugar')
  const saturatedFat = amount('saturatedFat')
  // Unknown values do not contribute to this lower bound; stored values remain null.
  const total = new Prisma.Decimal(protein ?? 0)
    .plus(carbs ?? 0)
    .plus(fat ?? 0)
    .plus(fiber ?? 0)
    .plus(salt ?? 0)

  if (total.greaterThan(100)) {
    throw new BadRequestException(
      'A fehérje, szénhidrát, zsír, rost és só együttes mennyisége legfeljebb 100 g lehet.',
    )
  }

  if (sugar !== null && carbs !== null && sugar > carbs) {
    throw new BadRequestException('A cukor mennyisége nem haladhatja meg a szénhidrát mennyiségét.')
  }

  if (saturatedFat !== null && fat !== null && saturatedFat > fat) {
    throw new BadRequestException(
      'A telített zsír mennyisége nem haladhatja meg a zsír mennyiségét.',
    )
  }
}
