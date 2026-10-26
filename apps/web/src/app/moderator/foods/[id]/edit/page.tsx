import FoodEditor from '@/components/foods/food-editor'

export default async function EditFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <FoodEditor
      apiBaseUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
      foodId={id}
    />
  )
}
