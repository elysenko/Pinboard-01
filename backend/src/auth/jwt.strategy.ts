import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser, JwtPayload } from './jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Validated at boot by validateEnv(), so this is always a real secret.
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Runs only after the signature and expiry have already been verified. */
  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload?.userId) throw new UnauthorizedException('Invalid token');
    return { userId: payload.userId, email: payload.email, role: payload.role };
  }
}
