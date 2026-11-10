import FoodHistory from '@/components/foods/food-history'

export default async function FoodHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <FoodHistory
      apiBaseUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
      foodId={id}
    />
  )
}
