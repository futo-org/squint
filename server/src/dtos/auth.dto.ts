import z from 'zod';
import { createZodDto } from '@immich/nestjs-standard-schema/zod';
import type { UserResponseDto } from 'src/dtos/user.dto.js';

const LoginQuerySchema = z.object({ returnTo: z.string().optional() });

const CallbackQuerySchema = z.object({ code: z.string().min(1), state: z.string().min(1) });

export const LoginStateSchema = z.object({
  state: z.string(),
  nonce: z.string(),
  codeVerifier: z.string(),
  returnTo: z.string(),
});

export class LoginQueryDto extends createZodDto(LoginQuerySchema) {}
export class CallbackQueryDto extends createZodDto(CallbackQuerySchema) {}

export type LoginStateDto = z.infer<typeof LoginStateSchema>;

export type AuthDto = { sessionId: string; user: UserResponseDto };

export type CiAuthDto = { repository: string; owner: string; ref: string; workflowRef: string };

export type AnyAuthDto = AuthDto | CiAuthDto;
