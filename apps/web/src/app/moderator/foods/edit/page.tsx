import FoodPicker from '@/components/foods/food-picker'

export default function PickFoodPage() {
  return <FoodPicker apiBaseUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'} />
}
