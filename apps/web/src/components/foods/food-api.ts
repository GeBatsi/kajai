export type EditableFood = {
  id: string
  name: string
  type: 'BASIC' | 'PRODUCT'
  category: string | null
  imageUrl: string | null
  nutrition: Record<string, unknown> | null
  allergens: Record<string, unknown> | null
}

export async function foodApiError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null)
  if (Array.isArray(data?.message)) {
    return (
      data.message.filter((message: unknown) => typeof message === 'string').join(' ') || fallback
    )
  }
  return typeof data?.message === 'string' ? data.message : fallback
}
