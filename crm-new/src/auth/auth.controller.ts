import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { DtoLogin } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Вход по паролю. Строгий лимит: до этого перебирать пароли можно было
   * без ограничений — охранник частоты висел только на приёме заявок.
   * Десяти попыток за пять минут хватает живому человеку, опечатавшемуся
   * в пароле, и делает перебор бессмысленным.
   */
  @Throttle({ default: { ttl: 300_000, limit: 10 } })
  @Post('login')
  login(@Body() dto: DtoLogin) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string; username: string; role: string }) {
    return user;
  }
}
