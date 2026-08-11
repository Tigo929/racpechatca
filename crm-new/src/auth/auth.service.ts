import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { DtoLogin } from './dto/login.dto';

/**
 * Хеш-заглушка для несуществующих логинов: сверка с ним занимает столько же
 * времени, сколько сверка с настоящим паролем. Это не секрет — от него
 * не подходит ни один пароль, он нужен только чтобы выровнять время ответа.
 */
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.ONjPoOMHGtSF5mVYNK1Ib0DzQvGO';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: DtoLogin) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    // Сверку выполняем всегда, даже когда логина нет: раньше несуществующий
    // пользователь получал отказ мгновенно, а существующий — после проверки
    // bcrypt, и по времени ответа можно было перебрать список логинов.
    const hash = user?.password ?? DUMMY_HASH;
    const valid = await bcrypt.compare(dto.password, hash);
    if (!user || !valid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const token = this.jwt.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
    return { access_token: token, role: user.role, username: user.username };
  }
}
