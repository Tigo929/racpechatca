import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import { DtoCreateUser } from './dto/create-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  getUsers() {
    return this.usersService.getUsers();
  }

  @Post()
  createUser(@Body() dto: DtoCreateUser) {
    return this.usersService.createUser(dto);
  }

  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
