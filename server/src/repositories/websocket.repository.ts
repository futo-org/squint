import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { WebsocketEvent } from 'src/enum.js';

export type ResourceChange = { resource: string };

@Injectable()
export class WebsocketRepository {
  private server?: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  update(...resources: string[]): void {
    for (const resource of resources) {
      this.server?.emit(WebsocketEvent.Change, { resource } satisfies ResourceChange);
    }
  }
}
