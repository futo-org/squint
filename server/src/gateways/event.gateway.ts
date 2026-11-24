import { type OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { Constants } from 'src/constants.js';
import { WebsocketRepository } from 'src/repositories/websocket.repository.js';
import { AuthService } from 'src/services/auth.service.js';
import { getCookie } from 'src/utils/request.js';

@WebSocketGateway({ path: Constants.Websocket.Path, transports: ['websocket'], serveClient: false })
export class EventGateway implements OnGatewayInit {
  constructor(
    private authService: AuthService,
    private websocketRepository: WebsocketRepository,
  ) {}

  afterInit(server: Server): void {
    server.use((socket, next) => void this.authenticate(socket, next));
    this.websocketRepository.setServer(server);
  }

  private async authenticate(socket: Socket, next: (error?: Error) => void) {
    try {
      await this.authService.authenticate(getCookie(socket.request.headers.cookie, Constants.Cookies.Session.Name));
    } catch {
      next(new Error(Constants.Websocket.UnauthorizedMessage));
      return;
    }

    next();
  }
}
