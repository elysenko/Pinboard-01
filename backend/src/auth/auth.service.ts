import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtPayload } from './jwt-payload';

const BCRYPT_ROUNDS = 10;
const UNIQUE_VIOLATION = 'P2002';
/** One message for both "unknown email" and "wrong password" — no account enumeration. */
const BAD_CREDENTIALS = 'Invalid email or password';

/** The user shape that leaves the API. `passwordHash` is structurally absent. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Bootstrapping rule: whoever registers on an empty instance owns it.
    // The count and the insert run in one transaction so two simultaneous first
    // signups cannot both read 0 and both become ADMIN.
    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const existingUsers = await tx.user.count();
        return tx.user.create({
          data: {
            email: dto.email,
            name: dto.name ?? null,
            passwordHash,
            role: existingUsers === 0 ? UserRole.ADMIN : UserRole.USER,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('An account with that email already exists');
      }
      throw error;
    }

    return this.issue(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Hash a throwaway value when the email is unknown so the response time does
    // not reveal whether the account exists.
    const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinva';
    const ok = await bcrypt.compare(dto.password, hash);
    if (!user || !ok) throw new UnauthorizedException(BAD_CREDENTIALS);

    return this.issue(user);
  }

  async findById(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return AuthService.toPublicUser(user);
  }

  private issue(user: User): AuthResponse {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    // Expiry comes from JwtModule's signOptions (JWT_EXPIRES_IN, default 1d) so the
    // lifetime is configured in exactly one place.
    return {
      accessToken: this.jwt.sign(payload),
      user: AuthService.toPublicUser(user),
    };
  }

  /** Explicit allowlist — adding a column to User can never leak it through the API. */
  static toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? '',
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
