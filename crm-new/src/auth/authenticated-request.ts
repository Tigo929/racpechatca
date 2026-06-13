import type { Request } from 'express';
import type { EnumRole } from 'src/generated/prisma/enums';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: EnumRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
