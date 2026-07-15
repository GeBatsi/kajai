import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    UsersModule,

    MailModule,

    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions:{
        expiresIn:'7d'
      }
    }),
  ],
  providers:[
    AuthService
  ],
  controllers:[
    AuthController
  ],
  exports:[
    AuthService
  ]
})
export class AuthModule {}
