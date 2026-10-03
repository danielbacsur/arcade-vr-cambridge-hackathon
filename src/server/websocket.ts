import type { Server, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';
import { resolveRouting, websocketTarget } from './routing.js';
export function installWebSocketProxy(server: Server): void {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });
  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const target = websocketTarget(request.url || '');
    const routing = resolveRouting(request.headers.host || '', request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http');
    const origin = request.headers.origin;
    if (!target || !routing || origin && !resolveRouting(new URL(origin).host, new URL(origin).protocol === 'https:' ? 'https' : 'http')) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    const protocols = request.headers['sec-websocket-protocol']?.split(',').map(value => value.trim());
    const upstream = new WebSocket(target, protocols, { origin: 'https://' + routing.upstream, handshakeTimeout: 15000, maxPayload: 16 * 1024 * 1024 });
    upstream.once('open', () => sockets.handleUpgrade(request, socket, head, downstream => {
      downstream.on('message', (data, binary) => { if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary }); });
      upstream.on('message', (data, binary) => { if (downstream.readyState === WebSocket.OPEN) downstream.send(data, { binary }); });
      downstream.on('close', (code, reason) => { if (upstream.readyState === WebSocket.OPEN) upstream.close(code === 1006 ? 1000 : code, reason); else upstream.terminate(); });
      upstream.on('close', (code, reason) => { if (downstream.readyState === WebSocket.OPEN) downstream.close(code === 1006 ? 1012 : code, reason); });
      downstream.on('error', () => upstream.terminate()); upstream.on('error', () => downstream.close(1011, 'Upstream connection failed'));
      // Each game owns reconnection and state synchronization; never replay input packets.
    }));
    upstream.once('error', () => socket.destroy()); socket.once('close', () => { if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate(); });
  });
}
