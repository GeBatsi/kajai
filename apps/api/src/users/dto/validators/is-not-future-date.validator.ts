import { registerDecorator, ValidationOptions } from 'class-validator'

// Elfogadja, ha a dátum a mai napig bezárólag van – jövőbeli dátumot elutasít.
export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (!value) return true
          const date = new Date(value as string)
          if (Number.isNaN(date.getTime())) return true // ezt az @IsDateString már elkapja
          return date.getTime() <= Date.now()
        },
        defaultMessage() {
          return 'A születési dátum nem lehet jövőbeli'
        },
      },
    })
  }
}
