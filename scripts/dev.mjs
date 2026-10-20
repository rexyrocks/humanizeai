import http from 'node:http';
import worker from '../worker/index.js';
const port=Number(process.env.PORT||4173);
const server=http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req){chunks.push(c);if(chunks.reduce((n,b)=>n+b.length,0)>100000){res.writeHead(413);res.end('Request too large');return;}}const body=Buffer.concat(chunks);const request=new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{} )});const response=await worker.fetch(request,process.env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Local server error');}});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
