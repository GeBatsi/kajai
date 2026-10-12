import FoodForm from '@/components/foods/food-form'

export default function NewFoodPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  return (
    <FoodForm
      apiBaseUrl={apiBaseUrl}
      backHref="/"
      title="Alapanyag létrehozása"
    />
  )
}