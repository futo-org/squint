import z from 'zod';
import { UserRole } from 'src/enum.js';
import { createZodDto } from 'src/zod.js';

const UserRoleSchema = z.enum(UserRole).meta({ id: 'UserRole' });

const UserResponseSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    name: z.string(),
    role: UserRoleSchema,
    avatarUrl: z.string().nullable(),
  })
  .meta({ id: 'UserResponseDto' });

export class UserResponseDto extends createZodDto(UserResponseSchema) {}
