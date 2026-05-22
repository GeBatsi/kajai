// ─── Enums ───────────────────────────────────────────────────────────────────

export type Role = 'GUEST' | 'USER' | 'MODERATOR' | 'ADMIN'
export type GoalType = 'WEIGHT_LOSS' | 'MUSCLE_GAIN' | 'MAINTENANCE' | 'RECOMPOSITION'
export type ActivityLevel =
  | 'SEDENTARY'
  | 'LIGHTLY_ACTIVE'
  | 'MODERATELY_ACTIVE'
  | 'VERY_ACTIVE'
  | 'EXTRA_ACTIVE'
export type FoodItemType = 'BASIC' | 'PRODUCT'
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'
export type FavoriteType = 'RECIPE' | 'FOOD' | 'PRODUCT'

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  role: Role
  createdAt: Date
  updatedAt: Date
}

export interface UserProfile {
  id: string
  userId: string
  gender: string | null
  dateOfBirth: Date | null
  heightCm: number | null
  weightKg: number | null
  bodyFatPct: number | null
  activityLevel: ActivityLevel
  goalType: GoalType
  tdeeKcal: number | null
  dailyKcal: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  updatedAt: Date
}

// ─── Food ─────────────────────────────────────────────────────────────────────

export interface Nutrition {
  energyKcal: number
  protein: number
  carbs: number
  sugar: number | null
  fat: number
  saturatedFat: number | null
  fiber: number | null
  salt: number | null
}

export interface Allergen {
  gluten: boolean
  milk: boolean
  egg: boolean
  soy: boolean
  nuts: boolean
  peanuts: boolean
  fish: boolean
  shellfish: boolean
  sesame: boolean
  celery: boolean
  mustard: boolean
  lupin: boolean
}

export interface FoodItem {
  id: string
  name: string
  type: FoodItemType
  brand: string | null
  eanBarcode: string | null
  imageUrl: string | null
  category: string | null
  packageSize: number | null
  packageUnit: string | null
  isVerified: boolean
  nutrition?: Nutrition
  allergens?: Allergen
}

// ─── Recipe ───────────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  id: string
  amount: number
  unit: string
  foodItem?: FoodItem
  childRecipe?: Recipe
}

export interface Recipe {
  id: string
  name: string
  description: string | null
  steps: string[]
  servings: number
  prepTimeMins: number | null
  imageUrl: string | null
  isPublic: boolean
  ownerId: string
  ingredients?: RecipeIngredient[]
  createdAt: Date
  updatedAt: Date
}

// ─── Logging ──────────────────────────────────────────────────────────────────

export interface MealLog {
  id: string
  userId: string
  date: Date
  mealType: MealType
  foodItem?: FoodItem
  recipe?: Recipe
  amount: number
  unit: string
}

export interface WeightLog {
  id: string
  userId: string
  date: Date
  weightKg: number
  bodyFatPct: number | null
}

export interface ActivityLog {
  id: string
  userId: string
  date: Date
  source: string
  caloriesBurned: number | null
  steps: number | null
  workouts: unknown
}

// ─── Store & Inventory ────────────────────────────────────────────────────────

export interface Store {
  id: string
  name: string
}

export interface ProductAvailability {
  id: string
  foodItemId: string
  storeId: string
  price: number | null
  unitPrice: number | null
  priceUpdatedAt: Date | null
  isAvailable: boolean
}

export interface InventoryItem {
  id: string
  userId: string
  foodItemId: string
  quantity: number
  unit: string
  expiryDate: Date | null
}

// ─── API Response wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  meta?: {
    total?: number
    page?: number
    limit?: number
  }
}

export interface ApiError {
  statusCode: number
  message: string
  error?: string
}
