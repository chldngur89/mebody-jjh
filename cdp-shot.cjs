const WebSocket=require('ws'),fs=require('fs');
const ws=new WebSocket(process.argv[2],{perMessageDeflate:false});
ws.on('open',()=>ws.send(JSON.stringify({id:1,method:'Page.captureScreenshot',params:{format:'png',fromSurface:process.argv[4]==='true'}})));
ws.on('message',d=>{const m=JSON.parse(d);if(m.id!==1)return;
 if(m.error){console.log('ERR',JSON.stringify(m.error));process.exit(1);}
 fs.writeFileSync(process.argv[3],Buffer.from(m.result.data,'base64'));console.log('ok');process.exit(0);});
ws.on('error',e=>{console.log('WS',e.message);process.exit(1);});
