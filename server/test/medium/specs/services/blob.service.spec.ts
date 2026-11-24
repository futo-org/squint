import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { buffer } from 'node:stream/consumers';
import type { DB } from 'src/schema/index.js';
import { BlobService } from 'src/services/blob.service.js';
import { type MediumContext, newMediumContext } from 'test/medium.factory.js';
import { getKyselyDB, newPng, sha256 } from 'test/utils.js';

describe(BlobService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: BlobService;

  beforeEach(async () => {
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.blobService;
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('upload', () => {
    it('stores a screenshot that can be downloaded', async () => {
      const png = newPng('button');
      const hash = sha256(png);

      const uploaded = await sut.upload(hash, png);

      const { stream, size } = await sut.download(hash);
      expect(uploaded).toEqual({ sha256: hash });
      expect(size).toBe(14);
      expect(new Uint8Array(await buffer(stream))).toEqual(png);
    });

    it('accepts the same screenshot again', async () => {
      const png = newPng('button');
      const hash = sha256(png);
      await sut.upload(hash, png);

      const result = sut.upload(hash, png);

      await expect(result).resolves.toEqual({ sha256: hash });
    });

    it('rejects content that does not match the hash', async () => {
      const hash = sha256(newPng('button'));

      const result = sut.upload(hash, newPng('alert'));

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(sut.download(hash)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects content that is not a png', async () => {
      const text = new TextEncoder().encode('<script>alert(1)</script>');

      const result = sut.upload(sha256(text), text);

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a screenshot larger than 20 MB', async () => {
      const png = new Uint8Array(20 * 1024 * 1024 + 1);
      png.set(newPng(''));

      const result = sut.upload(sha256(png), png);

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('download', () => {
    it('rejects an unknown screenshot', async () => {
      const result = sut.download('0'.repeat(64));

      await expect(result).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
