import { createServer } from 'node:http';
import { join } from 'node:path';
import { createProxy, type ProxyOptions } from './proxy.js';
import { installWebSocketProxy } from './websocket.js';
export function createApp(options: Partial<ProxyOptions> = {}) {
  const proxy = createProxy({ publicDirectory: join(process.cwd(), 'dist/public'), ...options });
  const server = createServer((request, response) => { void proxy(request, response); });
  installWebSocketProxy(server); return server;
}
