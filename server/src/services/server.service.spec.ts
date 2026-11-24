import { ServerService } from 'src/services/server.service.js';
import { newConfigRepository } from 'test/utils.js';

describe(ServerService.name, () => {
  describe('getAbout', () => {
    it('links the commit the image was built from', () => {
      const commit = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
      const sut = new ServerService(newConfigRepository({ build: { commit, date: new Date('2026-11-18T10:00:00Z') } }));

      expect(sut.getAbout()).toEqual({
        version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
        repositoryUrl: 'https://github.com/futo-org/squint',
        commit,
        commitUrl: `https://github.com/futo-org/squint/commit/${commit}`,
        buildDate: new Date('2026-11-18T10:00:00Z'),
      });
    });

    it('has no commit in a development build', () => {
      const sut = new ServerService(newConfigRepository());

      expect(sut.getAbout()).toMatchObject({ commit: null, commitUrl: null, buildDate: null });
    });
  });
});
