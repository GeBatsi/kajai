import { Request } from 'express';
import type { Role } from '@kajai/db';

export interface RequestUser {
  id: string;
  role: Role;
}

export interface RequestWithUser extends Request {
  user?: RequestUser;
}
