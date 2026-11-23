import { Module } from '@nestjs/common'
import { FoodsModule } from '../foods/foods.module'
import { NutritionCorrectionsService } from './nutrition-corrections.service'
import { CorrectionBodyInterceptor } from './correction-body.interceptor'
import {
  NutritionCorrectionModerationController,
  NutritionCorrectionSubmissionController,
  OwnNutritionCorrectionsController,
} from './nutrition-corrections.controller'

@Module({
  imports: [FoodsModule],
  providers: [NutritionCorrectionsService, CorrectionBodyInterceptor],
  controllers: [
    NutritionCorrectionSubmissionController,
    OwnNutritionCorrectionsController,
    NutritionCorrectionModerationController,
  ],
})
export class NutritionCorrectionsModule {}
