import { createServer } from 'node:http';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import { installWebSocketProxy } from '../src/server/websocket.js';
describe('multiplayer transport', () => {
  it('forwards text, binary and protocols without replay', async () => {
    const upstream = new WebSocketServer({ port: 0, host: '127.0.0.1' }); await once(upstream, 'listening');
    upstream.on('connection', socket => socket.on('message', (data, binary) => socket.send(data, { binary })));
    const address = upstream.address(); if (!address || typeof address === 'string') throw Error();
    const server = createServer(); let destination = '';
    installWebSocketProxy(server, (target, protocols) => { destination = target.href; return new WebSocket(`ws://127.0.0.1:${address.port}`, protocols); });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); const local = server.address(); if (!local || typeof local === 'string') throw Error();
    const client = new WebSocket(`ws://127.0.0.1:${local.port}/__arcade_ws/multiplayer/p/room?token=fixture`, ['arcade-test'], { headers: { host: `runtime.joinarcade.localhost:${local.port}` }, origin: `http://editor.joinarcade.localhost:${local.port}` });
    try {
      await once(client, 'open'); expect(client.protocol).toBe('arcade-test'); expect(destination).toBe('wss://multiplayer.joinarcade.ai/p/room?token=fixture');
      const text = once(client, 'message'); client.send('move'); const [message, binary] = await text; expect(String(message)).toBe('move'); expect(binary).toBe(false);
      const bytes = once(client, 'message'); client.send(new Uint8Array([0, 128, 255])); const [data, isBinary] = await bytes; expect([...data]).toEqual([0, 128, 255]); expect(isBinary).toBe(true);
    } finally { client.close(); await once(client, 'close'); await new Promise<void>(resolve => server.close(() => resolve())); await new Promise<void>(resolve => upstream.close(() => resolve())); }
  });
  it('rejects malformed origins without crashing the server', async () => {
    const server = createServer(); installWebSocketProxy(server); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address(); if (!address || typeof address === 'string') throw Error();
    const client = new WebSocket(`ws://127.0.0.1:${address.port}/__arcade_ws/multiplayer/p`, { headers: { host: 'runtime.localhost' }, origin: 'malformed' });
    try { const [error] = await once(client, 'error'); expect(String(error)).toContain('403'); } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
