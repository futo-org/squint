import { SquintEnvironment } from 'src/enum.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';

const required = {
  SQUINT_S3_BUCKET: 'screenshots',
  SQUINT_S3_ACCESS_KEY_ID: 'access-key',
  SQUINT_S3_SECRET_ACCESS_KEY: 'secret-key',
};

const stubEnv = (env: Record<string, string | undefined>) => {
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }
};

describe(ConfigRepository.name, () => {
  let sut: ConfigRepository;

  beforeEach(() => {
    sut = new ConfigRepository();
    stubEnv({
      SQUINT_DB_URL: undefined,
      SQUINT_PORT: undefined,
      SQUINT_TRUSTED_PROXIES: undefined,
      SQUINT_OAUTH_ISSUER: undefined,
      SQUINT_S3_ENDPOINT: undefined,
      SQUINT_S3_REGION: undefined,
      SQUINT_S3_FORCE_PATH_STYLE: undefined,
      SQUINT_BUILD_COMMIT: undefined,
      SQUINT_BUILD_DATE: undefined,
      SQUINT_CI_OWNERS: undefined,
      SQUINT_ENV: undefined,
      ...required,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getEnv', () => {
    it('uses the defaults when only the required variables are set', () => {
      expect(sut.getEnv()).toMatchObject({
        port: 3000,
        database: { url: 'postgres://postgres:postgres@localhost:5432/squint' },
        storage: {
          endpoint: undefined,
          region: 'us-east-1',
          bucket: 'screenshots',
          accessKeyId: 'access-key',
          secretAccessKey: 'secret-key',
          forcePathStyle: false,
        },
        network: { trustedProxies: ['loopback', 'linklocal', 'uniquelocal'] },
        github: { owners: ['futo-org', 'immich-app'] },
        environment: SquintEnvironment.Production,
      });
    });

    it('reads the environment', () => {
      stubEnv({ SQUINT_ENV: 'development' });

      expect(sut.getEnv().environment).toBe(SquintEnvironment.Development);
    });

    it('refuses an unknown environment', () => {
      stubEnv({ SQUINT_ENV: 'staging' });

      expect(() => sut.getEnv()).toThrow('SQUINT_ENV');
    });

    it('reads the owners allowed to publish', () => {
      stubEnv({ SQUINT_CI_OWNERS: 'immich-app, futo-org' });

      expect(sut.getEnv().github.owners).toEqual(['immich-app', 'futo-org']);
    });

    it('reads a storage endpoint with path style addressing', () => {
      stubEnv({
        SQUINT_S3_ENDPOINT: 'http://storage:9000',
        SQUINT_S3_REGION: 'auto',
        SQUINT_S3_FORCE_PATH_STYLE: 'true',
      });

      expect(sut.getEnv().storage).toMatchObject({
        endpoint: 'http://storage:9000',
        region: 'auto',
        forcePathStyle: true,
      });
    });

    it('reads the commit and date an image was built from', () => {
      stubEnv({
        SQUINT_BUILD_COMMIT: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
        SQUINT_BUILD_DATE: '2026-11-18T10:00:00Z',
      });

      expect(sut.getEnv().build).toEqual({
        commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
        date: new Date('2026-11-18T10:00:00Z'),
      });
    });

    it('treats an empty optional variable as not set', () => {
      stubEnv({ SQUINT_BUILD_COMMIT: '', SQUINT_BUILD_DATE: '', SQUINT_S3_ENDPOINT: '' });

      expect(sut.getEnv()).toMatchObject({ build: { commit: undefined, date: undefined } });
      expect(sut.getEnv().storage.endpoint).toBeUndefined();
    });

    it.each([
      { name: 'SQUINT_BUILD_COMMIT', value: 'main' },
      { name: 'SQUINT_BUILD_DATE', value: 'yesterday' },
      { name: 'SQUINT_S3_BUCKET', value: undefined },
      { name: 'SQUINT_S3_ACCESS_KEY_ID', value: '' },
      { name: 'SQUINT_S3_SECRET_ACCESS_KEY', value: undefined },
      { name: 'SQUINT_S3_ENDPOINT', value: 'storage:9000' },
      { name: 'SQUINT_S3_FORCE_PATH_STYLE', value: 'sometimes' },
      { name: 'SQUINT_PORT', value: 'http' },
      { name: 'SQUINT_PORT', value: '70000' },
      { name: 'SQUINT_DB_URL', value: 'localhost' },
      { name: 'SQUINT_OAUTH_ISSUER', value: 'auth.internal.futo.org' },
    ])('refuses $name set to $value', ({ name, value }) => {
      stubEnv({ [name]: value });

      expect(() => sut.getEnv()).toThrow(new RegExp(String.raw`Invalid environment variables[\s\S]*${name}`));
    });

    it('lists every invalid variable at once', () => {
      stubEnv({ SQUINT_S3_BUCKET: undefined, SQUINT_PORT: 'http' });

      expect(() => sut.getEnv()).toThrow(/SQUINT_S3_BUCKET[\s\S]*SQUINT_PORT|SQUINT_PORT[\s\S]*SQUINT_S3_BUCKET/);
    });
  });
});
