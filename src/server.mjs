import { createApp,loadConfig } from './app.mjs';
const cfg = loadConfig();
const port = Number(process.env.PORT || 10000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
const app = createApp(cfg);
app.listen(port, '0.0.0.0', () => console.log(JSON.stringify({event:'ready',service:'k-compute',port,mode:cfg.mode,external_ai:false})));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>app.close(()=>process.exit(0)));
