import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { FoodsService } from './foods.service';
import { FoodsController } from './foods.controller';

@Module({
  imports: [StorageModule],
  controllers: [FoodsController],
  providers: [FoodsService],
})
export class FoodsModule {}
