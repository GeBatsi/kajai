'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ChangeEvent, FormEvent, useMemo, useState } from 'react'

type FoodFormValues = {
  name: string
  category: string
  nutrition: {
    per: number
    unit: string
    energyKcal: string
    protein: string
    carbs: string
    sugar: string
    fat: string
    saturatedFat: string
    fiber: string
    salt: string
  }
  allergens: {
    gluten: boolean
    milk: boolean
    egg: boolean
    soy: boolean
    nuts: boolean
    peanuts: boolean
  }
}

const defaultValues: FoodFormValues = {
  name: '',
  category: '',
  nutrition: {
    per: 100,
    unit: 'g',
    energyKcal: '',
    protein: '',
    carbs: '',
    sugar: '',
    fat: '',
    saturatedFat: '',
    fiber: '',
    salt: '',
  },
  allergens: {
    gluten: false,
    milk: false,
    egg: false,
    soy: false,
    nuts: false,
    peanuts: false,
  },
}

type FoodFormProps = {
  apiBaseUrl: string
  backHref?: string
  title?: string
}

export default function FoodForm({
  apiBaseUrl,
  backHref = '/moderator',
  title = 'Alapanyag létrehozása',
}: FoodFormProps) {
  const { data: session } = useSession()
  const [values, setValues] = useState<FoodFormValues>(defaultValues)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const imagePreviewUrl = useMemo(() => {
    if (!imageFile) return null
    return URL.createObjectURL(imageFile)
  }, [imageFile])

  const handleTopLevelChange =
    (field: keyof Pick<FoodFormValues, 'name' | 'category'>) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({
        ...prev,
        [field]: e.target.value,
      }))
    }

  const handleNutritionChange =
    (field: keyof FoodFormValues['nutrition']) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({
        ...prev,
        nutrition: {
          ...prev.nutrition,
          [field]:
            field === 'per'
              ? Number(e.target.value)
              : e.target.value,
        },
      }))
    }

  const handleAllergenChange =
    (field: keyof FoodFormValues['allergens']) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({
        ...prev,
        allergens: {
          ...prev.allergens,
          [field]: e.target.checked,
        },
      }))
    }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      if (!session?.user.id || !session.user.role) {
        throw new Error('A felhasználói munkamenet hiányos. Jelentkezz be újra.')
      }

      const formData = new FormData()

      formData.append('name', values.name)
      formData.append('type', 'BASIC')
      formData.append('category', values.category)

      formData.append(
        'nutrition',
        JSON.stringify({
          per: 100,
          unit: 'g',
          energyKcal: values.nutrition.energyKcal ? Number(values.nutrition.energyKcal) : 0,
          protein: values.nutrition.protein ? Number(values.nutrition.protein) : 0,
          carbs: values.nutrition.carbs ? Number(values.nutrition.carbs) : 0,
          sugar: values.nutrition.sugar ? Number(values.nutrition.sugar) : 0,
          fat: values.nutrition.fat ? Number(values.nutrition.fat) : 0,
          saturatedFat: values.nutrition.saturatedFat ? Number(values.nutrition.saturatedFat) : 0,
          fiber: values.nutrition.fiber ? Number(values.nutrition.fiber) : 0,
          salt: values.nutrition.salt ? Number(values.nutrition.salt) : 0,
        }),
      )

      formData.append('allergens', JSON.stringify(values.allergens))

      if (imageFile) {
        formData.append('image', imageFile)
      }

      const response = await fetch(`${apiBaseUrl}/api/foods`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'x-user-id': session.user.id,
          'x-user-role': session.user.role,
        },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.message || 'A mentés sikertelen.')
      }

      setSuccess('Az alapanyag sikeresen létrejött.')
      setValues(defaultValues)
      setImageFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Váratlan hiba történt.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={backHref}
          className="mb-6 inline-block text-sm text-slate-500 hover:text-slate-700"
        >
          ← Vissza
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="mb-8 text-4xl font-bold text-slate-900">{title}</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm text-slate-600">Név</label>
              <input
                type="text"
                value={values.name}
                onChange={handleTopLevelChange('name')}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                placeholder="Pl. Csirkemell filé"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-600">Kategória</label>
              <input
                type="text"
                value={values.category}
                onChange={handleTopLevelChange('category')}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                placeholder="Pl. hús"
                required
              />
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">Tápértékek (100 g-ra)</p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Energia (kcal)"
                  value={values.nutrition.energyKcal}
                  onChange={handleNutritionChange('energyKcal')}
                />
                <Field
                  label="Fehérje (g)"
                  value={values.nutrition.protein}
                  onChange={handleNutritionChange('protein')}
                />
                <Field
                  label="Összes Szénhidrát (g)"
                  value={values.nutrition.carbs}
                  onChange={handleNutritionChange('carbs')}
                />
                <Field
                  label=" - Ebből Cukor (g)"
                  value={values.nutrition.sugar}
                  onChange={handleNutritionChange('sugar')}
                />
                <Field
                  label="Összes Zsír (g)"
                  value={values.nutrition.fat}
                  onChange={handleNutritionChange('fat')}
                />
                <Field
                  label="- Ebből Telített zsír (g)"
                  value={values.nutrition.saturatedFat}
                  onChange={handleNutritionChange('saturatedFat')}
                />
                <Field
                  label="Rost (g)"
                  value={values.nutrition.fiber}
                  onChange={handleNutritionChange('fiber')}
                />
                <Field
                  label="Só (g)"
                  value={values.nutrition.salt}
                  onChange={handleNutritionChange('salt')}
                />
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">Allergének</p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <CheckboxField
                  label="Glutén"
                  checked={values.allergens.gluten}
                  onChange={handleAllergenChange('gluten')}
                />
                <CheckboxField
                  label="Tej"
                  checked={values.allergens.milk}
                  onChange={handleAllergenChange('milk')}
                />
                <CheckboxField
                  label="Tojás"
                  checked={values.allergens.egg}
                  onChange={handleAllergenChange('egg')}
                />
                <CheckboxField
                  label="Szója"
                  checked={values.allergens.soy}
                  onChange={handleAllergenChange('soy')}
                />
                <CheckboxField
                  label="Diófélék"
                  checked={values.allergens.nuts}
                  onChange={handleAllergenChange('nuts')}
                />
                <CheckboxField
                  label="Földimogyoró"
                  checked={values.allergens.peanuts}
                  onChange={handleAllergenChange('peanuts')}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-600">Kép</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
              />

              {imagePreviewUrl && (
                <div className="mt-4">
                  <p className="mb-2 text-sm text-slate-600">Előnézet</p>
                  <img
                    src={imagePreviewUrl}
                    alt="Előnézet"
                    className="h-40 w-40 rounded-xl border border-slate-200 object-cover"
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-base font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Mentés...' : 'Mentés'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

type FieldProps = {
  label: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}

function Field({ label, value, onChange }: FieldProps) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-600">{label}</label>
      <input
        type="number"
        step="0.1"
        min="0"
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
      />
    </div>
  )
}

type CheckboxFieldProps = {
  label: string
  checked: boolean
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}

function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  )
}
