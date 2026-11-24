import type { Kysely } from 'kysely';
import { BlobRepository } from 'src/repositories/blob.repository.js';
import type { DB } from 'src/schema/index.js';
import { getKyselyDB } from 'test/utils.js';

describe(BlobRepository.name, () => {
  let db: Kysely<DB>;
  let sut: BlobRepository;

  const stored = 'a'.repeat(64);
  const missing = 'b'.repeat(64);

  beforeEach(async () => {
    db = await getKyselyDB();
    sut = new BlobRepository(db);
    await sut.createIfMissing({ sha256: stored, size: 10 }, () => Promise.resolve());
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('getExisting', () => {
    it('returns only the hashes that are stored', async () => {
      await expect(sut.getExisting([stored, missing])).resolves.toEqual(new Set([stored]));
    });

    it('returns nothing for an empty list', async () => {
      await expect(sut.getExisting([])).resolves.toEqual(new Set());
    });

    it('checks more hashes than a build can publish', async () => {
      const hashes = Array.from({ length: 10_000 }, (_, index) => index.toString(16).padStart(64, '0'));

      await expect(sut.getExisting([...hashes, stored])).resolves.toEqual(new Set([stored]));
    });
  });

  describe('createIfMissing', () => {
    it('stores a new blob and records it', async () => {
      const store = vi.fn().mockResolvedValue(undefined);

      await sut.createIfMissing({ sha256: missing, size: 5 }, store);

      expect(store).toHaveBeenCalledOnce();
      await expect(sut.get(missing)).resolves.toMatchObject({ sha256: missing, size: 5 });
    });

    it('keeps the first record and stores nothing when the hash is known', async () => {
      const store = vi.fn().mockResolvedValue(undefined);

      await sut.createIfMissing({ sha256: stored, size: 99 }, store);

      expect(store).not.toHaveBeenCalled();
      await expect(sut.get(stored)).resolves.toMatchObject({ sha256: stored, size: 10 });
    });

    it('records nothing when storing fails', async () => {
      const store = vi.fn().mockRejectedValue(new Error('storage is down'));

      await expect(sut.createIfMissing({ sha256: missing, size: 5 }, store)).rejects.toThrow('storage is down');

      await expect(sut.get(missing)).resolves.toBeUndefined();
    });
  });
});
