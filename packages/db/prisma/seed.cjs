const { PrismaClient, FoodItemType } = require('@prisma/client')

const prisma = new PrismaClient()

const foods = [
  {
    id: 'seed_food_chicken_breast',
    name: 'Csirkemell',
    category: 'hus',
    defaultUnit: 'g',
    density: null,
    nutrition: {
      energyKcal: 120,
      protein: 23,
      carbs: 0,
      fat: 2,
    },
  },
  {
    id: 'seed_food_white_rice',
    name: 'Feher rizs',
    category: 'gabonafele',
    defaultUnit: 'g',
    density: null,
    nutrition: {
      energyKcal: 365,
      protein: 7,
      carbs: 80,
      fat: 1,
    },
  },
  {
    id: 'seed_food_egg',
    name: 'Tojas',
    category: 'tejtermek-es-tojas',
    defaultUnit: 'db',
    density: null,
    nutrition: {
      energyKcal: 155,
      protein: 13,
      carbs: 1,
      fat: 11,
    },
  },
  {
    id: 'seed_food_oats',
    name: 'Zabpehely',
    category: 'gabonafele',
    defaultUnit: 'g',
    density: null,
    nutrition: {
      energyKcal: 389,
      protein: 17,
      carbs: 66,
      fat: 7,
    },
  },
  {
    id: 'seed_food_apple',
    name: 'Alma',
    category: 'gyumolcs',
    defaultUnit: 'g',
    density: null,
    nutrition: {
      energyKcal: 52,
      protein: 0.3,
      carbs: 14,
      fat: 0.2,
    },
  },
]

async function main() {
  for (const food of foods) {
    await prisma.foodItem.upsert({
      where: { id: food.id },
      update: {
        name: food.name,
        type: FoodItemType.BASIC,
        category: food.category,
        nutrition: food.nutrition,
        isVerified: true,
      },
      create: {
        id: food.id,
        name: food.name,
        type: FoodItemType.BASIC,
        category: food.category,
        nutrition: food.nutrition,
        isVerified: true,
      },
    })

    await prisma.ingredient.upsert({
      where: { foodItemId: food.id },
      update: {
        defaultUnit: food.defaultUnit,
        density: food.density,
        isGeneric: true,
      },
      create: {
        foodItemId: food.id,
        defaultUnit: food.defaultUnit,
        density: food.density,
        isGeneric: true,
      },
    })
  }

  console.log(`Seeded ${foods.length} food items and ${foods.length} ingredients.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
