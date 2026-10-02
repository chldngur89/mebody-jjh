const WebSocket=require('ws');
const ws=new WebSocket(process.argv[2],{perMessageDeflate:false});
const expr=require('fs').readFileSync(process.argv[3],'utf8');
ws.on('open',()=>ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,returnByValue:true,awaitPromise:true}})));
ws.on('message',d=>{const m=JSON.parse(d);if(m.id!==1)return;const r=m.result;
 if(r.exceptionDetails)console.log('EXC',JSON.stringify(r.exceptionDetails.exception));
 else console.log(typeof r.result.value==='string'?r.result.value:JSON.stringify(r.result.value,null,1));
 process.exit(0);});
ws.on('error',e=>{console.log('WS',e.message);process.exit(1);});
