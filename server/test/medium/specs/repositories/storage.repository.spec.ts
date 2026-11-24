import { buffer } from 'node:stream/consumers';
import { StorageRepository } from 'src/repositories/storage.repository.js';
import { newConfigRepository, newStorageEnv } from 'test/utils.js';

describe(StorageRepository.name, () => {
  let sut: StorageRepository;

  beforeEach(async () => {
    sut = new StorageRepository(newConfigRepository({ storage: await newStorageEnv() }));
  });

  describe('get', () => {
    it('returns what was stored under the key', async () => {
      await sut.put('blobs/ab/home.png', new Uint8Array([1, 2, 3, 4]));

      const blob = await sut.get('blobs/ab/home.png');

      expect(blob?.size).toBe(4);
      await expect(buffer(blob!.stream)).resolves.toEqual(Buffer.from([1, 2, 3, 4]));
    });

    it('returns nothing for a key that was never stored', async () => {
      await sut.put('blobs/ab/home.png', new Uint8Array([1]));

      await expect(sut.get('blobs/ab/other.png')).resolves.toBeUndefined();
    });

    it('fails when the bucket does not exist', async () => {
      const storage = await newStorageEnv();
      sut = new StorageRepository(newConfigRepository({ storage: { ...storage, bucket: 'squint-missing-bucket' } }));

      await expect(sut.get('blobs/ab/home.png')).rejects.toMatchObject({ name: 'NoSuchBucket' });
    });
  });

  describe('delete', () => {
    it('removes the listed keys and keeps the others', async () => {
      await sut.put('blobs/ab/home.png', new Uint8Array([1]));
      await sut.put('blobs/ab/about.png', new Uint8Array([2]));
      await sut.put('blobs/cd/login.png', new Uint8Array([3]));

      await sut.delete(['blobs/ab/home.png', 'blobs/cd/login.png']);

      await expect(sut.get('blobs/ab/home.png')).resolves.toBeUndefined();
      await expect(sut.get('blobs/cd/login.png')).resolves.toBeUndefined();
      await expect(sut.get('blobs/ab/about.png')).resolves.toMatchObject({ size: 1 });
    });

    it('accepts keys that are already gone', async () => {
      await expect(sut.delete(['blobs/ab/never-stored.png'])).resolves.toBeUndefined();
    });

    it('does nothing for an empty list', async () => {
      await expect(sut.delete([])).resolves.toBeUndefined();
    });

    it('removes more keys than one request can carry', async () => {
      const keys = Array.from({ length: 1001 }, (_, index) => `blobs/many/${index}.png`);
      await Promise.all(keys.map((key) => sut.put(key, new Uint8Array([1]))));

      await sut.delete(keys);

      await expect(sut.get(keys[0])).resolves.toBeUndefined();
      await expect(sut.get(keys[1000])).resolves.toBeUndefined();
    });

    it('fails when the bucket does not exist', async () => {
      const storage = await newStorageEnv();
      sut = new StorageRepository(newConfigRepository({ storage: { ...storage, bucket: 'squint-missing-bucket' } }));

      await expect(sut.delete(['blobs/ab/home.png'])).rejects.toMatchObject({ name: 'NoSuchBucket' });
    });
  });
});
