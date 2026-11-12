import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions:{
        expiresIn:'7d'
      }
    }),
  ],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}