import { Module } from '@nestjs/common';
import { FoodsService } from './foods.service';
import { FoodsController } from './foods.controller';

@Module({
  controllers: [FoodsController],
  providers: [FoodsService],
})
export class FoodsModule {}
