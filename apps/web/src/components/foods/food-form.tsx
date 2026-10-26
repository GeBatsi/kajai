'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ChangeEvent, FormEvent, useEffect, useId, useRef, useState } from 'react'
import { EditableFood, foodApiError } from './food-api'
import { allergenFields, nutritionFields } from './food-fields'

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
  initialFood?: EditableFood
}

function formValues(food?: EditableFood): FoodFormValues {
  if (!food) return defaultValues
  const nutrition = food.nutrition ?? {}
  const amount = (key: string, legacyKey?: string) => {
    const value = nutrition[key] ?? (legacyKey ? nutrition[legacyKey] : undefined)
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
  }
  return {
    name: food.name,
    category: food.category ?? '',
    nutrition: {
      per: typeof nutrition.per === 'number' ? nutrition.per : 100,
      unit: typeof nutrition.unit === 'string' ? nutrition.unit : 'g',
      energyKcal: amount('energyKcal', 'kcal'),
      protein: amount('protein', 'proteinG'),
      carbs: amount('carbs', 'carbsG'),
      sugar: amount('sugar'),
      fat: amount('fat', 'fatG'),
      saturatedFat: amount('saturatedFat'),
      fiber: amount('fiber'),
      salt: amount('salt'),
    },
    allergens: {
      gluten: food.allergens?.gluten === true,
      milk: food.allergens?.milk === true,
      egg: food.allergens?.egg === true,
      soy: food.allergens?.soy === true,
      nuts: food.allergens?.nuts === true,
      peanuts: food.allergens?.peanuts === true,
    },
  }
}

export default function FoodForm({
  apiBaseUrl,
  backHref = '/moderator',
  title = 'Alapanyag létrehozása',
  initialFood,
}: FoodFormProps) {
  const { data: session } = useSession()
  const [savedFood, setSavedFood] = useState(initialFood)
  const [values, setValues] = useState<FoodFormValues>(() => formValues(initialFood))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState(initialFood?.imageUrl ?? null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageSuccess, setImageSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isEditing = Boolean(initialFood)
  const isBusy = isSubmitting || isSavingImage
  const hasPendingImage = isEditing && imageFile !== null

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const clearImageSelection = () => {
    setImageFile(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const requireSession = () => {
    if (!session?.user.id) {
      throw new Error('A felhasználói munkamenet hiányos. Jelentkezz be újra.')
    }
  }

  const handleTopLevelChange =
    (field: keyof Pick<FoodFormValues, 'name' | 'category'>) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setSuccess(null)
      setValues((prev) => ({
        ...prev,
        [field]: e.target.value,
      }))
    }

  const handleNutritionChange =
    (field: keyof FoodFormValues['nutrition']) => (e: ChangeEvent<HTMLInputElement>) => {
      setSuccess(null)
      setValues((prev) => ({
        ...prev,
        nutrition: {
          ...prev.nutrition,
          [field]: field === 'per' ? Number(e.target.value) : e.target.value,
        },
      }))
    }

  const handleAllergenChange =
    (field: keyof FoodFormValues['allergens']) => (e: ChangeEvent<HTMLInputElement>) => {
      setSuccess(null)
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
    setImageError(null)
    setImageSuccess(null)
  }

  const saveImage = async (remove = false) => {
    if (!initialFood || isBusy || (!remove && !imageFile)) return
    setIsSavingImage(true)
    setImageError(null)
    setImageSuccess(null)
    try {
      requireSession()
      const body = new FormData()
      if (imageFile) body.append('image', imageFile)
      const response = await fetch(
        `${apiBaseUrl}/api/foods/${encodeURIComponent(initialFood.id)}/image`,
        {
          method: remove ? 'DELETE' : 'PATCH',
          credentials: 'include',
          ...(remove ? {} : { body }),
        },
      )
      if (!response.ok) {
        throw new Error(
          await foodApiError(
            response,
            remove ? 'A kép törlése sikertelen.' : 'A kép mentése sikertelen.',
          ),
        )
      }
      const updated: EditableFood | null = remove ? null : await response.json()
      setCurrentImageUrl(updated?.imageUrl ?? null)
      clearImageSelection()
      setImageSuccess(remove ? 'A kép sikeresen törölve.' : 'A kép sikeresen mentve.')
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'A képmódosítás sikertelen.')
    } finally {
      setIsSavingImage(false)
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isBusy || hasPendingImage) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      requireSession()
      const name = values.name.trim()
      if (!name) throw new Error('Az alapanyag neve kötelező.')
      if (name.length > 200) throw new Error('Az alapanyag neve legfeljebb 200 karakter lehet.')
      const nutrition = {
        ...nutritionFields(savedFood?.nutrition),
        per: values.nutrition.per,
        unit: values.nutrition.unit,
        energyKcal: values.nutrition.energyKcal ? Number(values.nutrition.energyKcal) : 0,
        protein: values.nutrition.protein ? Number(values.nutrition.protein) : 0,
        carbs: values.nutrition.carbs ? Number(values.nutrition.carbs) : 0,
        sugar: values.nutrition.sugar ? Number(values.nutrition.sugar) : 0,
        fat: values.nutrition.fat ? Number(values.nutrition.fat) : 0,
        saturatedFat: values.nutrition.saturatedFat ? Number(values.nutrition.saturatedFat) : 0,
        fiber: values.nutrition.fiber ? Number(values.nutrition.fiber) : 0,
        salt: values.nutrition.salt ? Number(values.nutrition.salt) : 0,
      }
      const allergens = { ...allergenFields(savedFood?.allergens), ...values.allergens }
      let response: Response
      if (initialFood) {
        const previous = formValues(savedFood)
        response = await fetch(`${apiBaseUrl}/api/foods/${encodeURIComponent(initialFood.id)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            category: values.category,
            ...(JSON.stringify(values.nutrition) !== JSON.stringify(previous.nutrition)
              ? { nutrition }
              : {}),
            ...(JSON.stringify(values.allergens) !== JSON.stringify(previous.allergens)
              ? { allergens }
              : {}),
          }),
        })
      } else {
        const body = new FormData()
        body.append('name', name)
        body.append('type', 'BASIC')
        body.append('category', values.category)
        body.append('nutrition', JSON.stringify(nutrition))
        body.append('allergens', JSON.stringify(allergens))
        if (imageFile) body.append('image', imageFile)
        response = await fetch(`${apiBaseUrl}/api/foods`, {
          method: 'POST',
          body,
          credentials: 'include',
        })
      }

      if (!response.ok) {
        throw new Error(await foodApiError(response, 'A mentés sikertelen.'))
      }

      if (initialFood) {
        const updated: EditableFood = await response.json()
        setSavedFood(updated)
        setValues(formValues(updated))
        setSuccess('Az alapanyag adatai sikeresen módosultak.')
      } else {
        setSuccess('Az alapanyag sikeresen létrejött.')
        setValues(defaultValues)
        clearImageSelection()
      }
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

        <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-8 text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h1>

          <form onSubmit={handleSubmit}>
            <fieldset disabled={isBusy} className="space-y-6">
              <legend className="sr-only">Alapanyag adatai</legend>
              <div>
                <label htmlFor="food-name" className="mb-2 block text-sm text-slate-600">
                  Név
                </label>
                <input
                  id="food-name"
                  type="text"
                  value={values.name}
                  onChange={handleTopLevelChange('name')}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                  placeholder="Pl. Csirkemell filé"
                  maxLength={200}
                  required
                />
              </div>

              <div>
                <label htmlFor="food-category" className="mb-2 block text-sm text-slate-600">
                  Kategória
                </label>
                <input
                  id="food-category"
                  type="text"
                  value={values.category}
                  onChange={handleTopLevelChange('category')}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                  placeholder="Pl. hús"
                  required={!isEditing}
                />
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-slate-700">
                  Tápértékek ({values.nutrition.per} {values.nutrition.unit})
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Energia (kcal)"
                    value={values.nutrition.energyKcal}
                    max={900}
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
                <label htmlFor="food-image" className="mb-2 block text-sm text-slate-600">
                  Kép
                </label>
                <p id="food-image-help" className="mb-3 text-sm text-slate-500">
                  JPG, PNG vagy WebP formátum. Minimum 300×300 pixel, legfeljebb 5 MB.
                </p>
                {isEditing && (
                  <p className="mb-3 text-sm text-slate-500">
                    A kép módosítását külön mentheted az alapanyag adataitól.
                  </p>
                )}
                <input
                  id="food-image"
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-describedby="food-image-help"
                  onChange={handleImageChange}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                />

                {(imagePreviewUrl || currentImageUrl) && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm text-slate-600">
                      {imageFile ? 'Új kép előnézete' : 'Jelenlegi kép'}
                    </p>
                    <img
                      src={imagePreviewUrl || currentImageUrl || ''}
                      alt={imageFile ? 'Új kép előnézete' : `${values.name} jelenlegi képe`}
                      className="h-40 w-40 rounded-xl border border-slate-200 object-cover"
                    />
                  </div>
                )}
                {isEditing && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {imageFile && (
                      <button
                        type="button"
                        onClick={() => void saveImage()}
                        className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white"
                      >
                        {isSavingImage ? 'Kép mentése...' : 'Kép mentése'}
                      </button>
                    )}
                    {imageFile && (
                      <button
                        type="button"
                        onClick={clearImageSelection}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
                      >
                        Kiválasztás visszavonása
                      </button>
                    )}
                    {currentImageUrl && !imageFile && (
                      <button
                        type="button"
                        onClick={() => void saveImage(true)}
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700"
                      >
                        {isSavingImage ? 'Kép törlése...' : 'Kép törlése'}
                      </button>
                    )}
                  </div>
                )}
                {imageError && (
                  <p role="alert" className="mt-3 text-sm text-red-700">
                    {imageError}
                  </p>
                )}
                {imageSuccess && (
                  <p role="status" className="mt-3 text-sm text-green-700">
                    {imageSuccess}
                  </p>
                )}
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
                >
                  {success}
                </div>
              )}

              {hasPendingImage && (
                <p id="pending-image-message" role="status" className="text-sm text-amber-800">
                  Új képet választottál. Az adatok mentése előtt mentsd a képet, vagy vond vissza a
                  kiválasztást.
                </p>
              )}

              <button
                type="submit"
                disabled={isBusy || hasPendingImage}
                aria-describedby={hasPendingImage ? 'pending-image-message' : undefined}
                className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-base font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Mentés...' : isEditing ? 'Adatok mentése' : 'Mentés'}
              </button>
            </fieldset>
          </form>
        </div>
      </div>
    </div>
  )
}

type FieldProps = {
  label: string
  value: string
  max?: number
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}

function Field({ label, value, max, onChange }: FieldProps) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-slate-600">
        {label}
      </label>
      <input
        id={id}
        type="number"
        step="0.1"
        min="0"
        max={max}
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
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4" />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  )
}
