import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthResponse, AuthService, PublicUser } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { AuthenticatedUser } from './jwt-payload';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register; the first account on an instance becomes ADMIN' })
  signup(@Body() dto: SignupDto): Promise<AuthResponse> {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for an access token' })
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ends the client session',
    description:
      'Tokens are stateless, so there is no server-side session to destroy. This ' +
      'endpoint confirms the caller held a valid token and instructs the client to ' +
      'discard it; the token remains technically valid until it expires.',
  })
  logout(): { ok: true } {
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'The signed-in user' })
  // Re-read from the database rather than echoing token claims, so a role change
  // takes effect without waiting for the token to expire.
  me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.authService.findById(user.userId);
  }
}
