import { Module } from '@nestjs/common';
import { StorageModule } from './storage/storage.module';
import { FoodsController } from './foods/foods.controller';
import { FoodsService } from './foods/foods.service';

@Module({
  imports: [StorageModule],
  controllers: [FoodsController],
  providers: [FoodsService],
})
export class FoodsModule {}