import { SetMetadata } from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: EnumRole[]) => SetMetadata(ROLES_KEY, roles);
