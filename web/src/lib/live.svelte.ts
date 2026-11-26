import { queryClient } from '#lib/queries/client.js';
import { io, type Socket } from 'socket.io-client';
import { Constants } from './constants.js';
import { isAffected } from './live-changes.js';

class LiveConnection {
  connected = $state(false);

  #socket?: Socket;
  #hasConnected = false;

  connect() {
    type ResourceChange = { resource: string };
    if (this.#socket) {
      return;
    }

    this.#socket = io({ path: Constants.Live.Path, transports: ['websocket'] });
    this.#socket.on('connect', () => this.#handleConnect());
    this.#socket.on('disconnect', () => (this.connected = false));
    this.#socket.on(Constants.Live.ChangeEvent, ({ resource }: ResourceChange) => {
      void queryClient.invalidateQueries({ predicate: ({ queryKey }) => isAffected(queryKey, resource) });
    });
  }

  disconnect() {
    this.#socket?.disconnect();
    this.#socket = undefined;
    this.#hasConnected = false;
    this.connected = false;
  }

  #handleConnect() {
    this.connected = true;
    if (this.#hasConnected) {
      void queryClient.invalidateQueries();
    }

    this.#hasConnected = true;
  }
}

export const live = new LiveConnection();
