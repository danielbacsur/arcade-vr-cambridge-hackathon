import { createApp } from './app.js';
const port = Number(process.env.PORT || 8765), host = process.env.HOST || '127.0.0.1';
createApp().listen(port, host, () => console.log(`Arcade proxy: http://localhost:${port}`));
