import { Injectable } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Constants } from 'src/constants.js';

@Injectable()
export class CryptoRepository {
  randomToken(): string {
    return randomBytes(Constants.Session.TokenBytes).toString('base64url');
  }

  hashSha256(value: string | Uint8Array): string {
    return createHash('sha256').update(value).digest('hex');
  }

  verifyHmacSha256({ secret, message, signature }: { secret: string; message: string; signature: string }): boolean {
    if (!secret) {
      return false;
    }

    const expected = createHmac('sha256', secret).update(message).digest();
    const actual = Buffer.from(signature.slice(signature.indexOf('=') + 1), 'hex');

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
