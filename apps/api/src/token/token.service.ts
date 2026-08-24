import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  generateToken(id: string, email: string) {
    return this.jwtService.sign({
      sub: id,
      email,
    });
  }
}