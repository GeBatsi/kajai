import {
  applyDecorators,
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { parseNutrition } from '../foods/food-json.schema'

const BODY_FIELDS = 'nutrition-correction-body-fields'

// Validate the raw JSON before ValidationPipe/class-transformer can discard prototype
// keys or infer a type from an attacker-controlled nested `constructor` property.
@Injectable()
export class CorrectionBodyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const fields = this.reflector.get<readonly string[]>(BODY_FIELDS, context.getHandler())
    const body: unknown = context.switchToHttp().getRequest().body ?? {}
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('A kérés törzse JSON objektum legyen.')
    const values = body as Record<string, unknown>
    for (const key of Object.keys(values))
      if (!fields.includes(key)) throw new BadRequestException(`Ismeretlen request mező: ${key}.`)
    if (fields.includes('reason') && typeof values.reason !== 'string')
      throw new BadRequestException('Az indoklás szöveg legyen.')
    if (fields.includes('nutrition')) {
      if (
        !values.nutrition ||
        typeof values.nutrition !== 'object' ||
        Array.isArray(values.nutrition)
      )
        throw new BadRequestException('A nutrition mező objektum legyen.')
      parseNutrition(values.nutrition)
    }
    return next.handle()
  }
}

export const CorrectionBody = (...fields: ('reason' | 'nutrition')[]) =>
  applyDecorators(SetMetadata(BODY_FIELDS, fields), UseInterceptors(CorrectionBodyInterceptor))
