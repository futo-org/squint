import { UnauthorizedException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import { EventGateway } from 'src/gateways/event.gateway.js';
import { WebsocketRepository } from 'src/repositories/websocket.repository.js';
import { AuthService } from 'src/services/auth.service.js';

describe(EventGateway.name, () => {
  let app: NestExpressApplication;
  let url: string;
  let websocketRepository: WebsocketRepository;
  const sockets: Socket[] = [];
  const authService = { authenticate: vi.fn() };

  const connect = (cookie?: string) => {
    const socket = io(url, {
      path: '/api/socket.io',
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      extraHeaders: cookie ? { cookie } : {},
    });
    sockets.push(socket);

    return new Promise<{ socket: Socket; error?: Error }>((resolve) => {
      socket.once('connect', () => resolve({ socket }));
      socket.once('connect_error', (error) => resolve({ socket, error }));
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [EventGateway, WebsocketRepository, { provide: AuthService, useValue: authService }],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    websocketRepository = app.get(WebsocketRepository);

    return () => app.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.disconnect();
    }
  });

  describe('connect', () => {
    it('signs a client in with its session cookie', async () => {
      authService.authenticate.mockResolvedValue({ sessionId: 'session-1' });

      const { socket, error } = await connect('theme=dark; squint_access_token=session-token');

      expect(error).toBeUndefined();
      expect(socket.connected).toBe(true);
      expect(authService.authenticate).toHaveBeenCalledWith('session-token');
    });

    it('refuses a client without a session', async () => {
      authService.authenticate.mockRejectedValue(new UnauthorizedException());

      const { socket, error } = await connect();

      expect(error?.message).toBe('Unauthorized');
      expect(socket.connected).toBe(false);
      expect(authService.authenticate).toHaveBeenCalledWith(undefined);
    });

    it('hides why the sign in failed', async () => {
      authService.authenticate.mockRejectedValue(new Error('connection to database lost'));

      const { error } = await connect('squint_access_token=session-token');

      expect(error?.message).toBe('Unauthorized');
    });
  });

  describe('change', () => {
    it('tells a signed in client which resources changed', async () => {
      authService.authenticate.mockResolvedValue({ sessionId: 'session-1' });
      const { socket } = await connect('squint_access_token=session-token');
      const changes: unknown[] = [];
      const received = new Promise<void>((resolve) => {
        socket.on('change', (change) => {
          changes.push(change);
          if (changes.length === 2) {
            resolve();
          }
        });
      });

      websocketRepository.update('/builds/build-1', '/projects');
      await received;

      expect(changes).toEqual([{ resource: '/builds/build-1' }, { resource: '/projects' }]);
    });
  });
});
