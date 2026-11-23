import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { Role } from '@kajai/db'
import { MinRole } from '../auth/decorators/min-role.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { RequestUser } from '../auth/types/request-user.type'
import { NutritionCorrectionsService } from './nutrition-corrections.service'
import { CorrectionBody } from './correction-body.interceptor'
import {
  ApproveNutritionCorrectionDto,
  CorrectionQueryDto,
  CorrectionReasonDto,
  ModerationCorrectionQueryDto,
  SubmitNutritionCorrectionDto,
} from './dto/nutrition-correction.dto'

@Controller('foods/:id/nutrition-corrections')
@MinRole(Role.USER)
export class NutritionCorrectionSubmissionController {
  constructor(private readonly corrections: NutritionCorrectionsService) {}

  @Post()
  @CorrectionBody('nutrition', 'reason')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitNutritionCorrectionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.corrections.submit(id, dto, user.id)
  }
}

@Controller('nutrition-corrections')
@MinRole(Role.USER)
export class OwnNutritionCorrectionsController {
  constructor(private readonly corrections: NutritionCorrectionsService) {}

  @Get('mine')
  mine(@Query() query: CorrectionQueryDto, @CurrentUser() user: RequestUser) {
    return this.corrections.mine(user.id, query)
  }
}

@Controller('moderation/nutrition-corrections')
@MinRole(Role.MODERATOR)
export class NutritionCorrectionModerationController {
  constructor(private readonly corrections: NutritionCorrectionsService) {}

  @Get()
  list(@Query() query: ModerationCorrectionQueryDto) {
    return this.corrections.list(query)
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.corrections.detail(id, user.id)
  }

  @Post(':id/approve')
  @CorrectionBody()
  @HttpCode(200)
  approve(
    @Param('id') id: string,
    @Body() _dto: ApproveNutritionCorrectionDto,
    @CurrentUser() user: RequestUser,
  ) {
    void _dto
    return this.corrections.approve(id, user.id)
  }

  @Post(':id/reject')
  @CorrectionBody('reason')
  @HttpCode(200)
  reject(
    @Param('id') id: string,
    @Body() dto: CorrectionReasonDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.corrections.reject(id, dto.reason, user.id)
  }
}
