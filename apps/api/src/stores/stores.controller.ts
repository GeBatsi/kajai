import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Prisma, Store } from '@kajai/db';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

type StoreWithProducts = Prisma.StoreGetPayload<{
  include: {
    products: {
      include: {
        foodItem: true;
      };
    };
  };
}>;

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  create(@Body() dto: CreateStoreDto): Promise<Store> {
    return this.storesService.create(dto);
  }

  @Get()
  findAll(@Query('search') search?: string): Promise<Store[]> {
    return this.storesService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<StoreWithProducts> {
    return this.storesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStoreDto): Promise<Store> {
    return this.storesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<Store> {
    return this.storesService.remove(id);
  }
}
