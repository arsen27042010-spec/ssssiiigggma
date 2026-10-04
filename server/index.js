import { createServer } from './app.js';
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const app=createServer();
app.server.listen(port,host,()=>console.log(`Рубеж — http://localhost:${port} (${host})`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
