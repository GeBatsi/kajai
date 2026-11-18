import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(PickType(CreateUserDto, ['name', 'image'] as const)) {}
