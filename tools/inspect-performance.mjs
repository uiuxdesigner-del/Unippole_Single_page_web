const targets = await (await fetch('http://127.0.0.1:9225/json/list')).json();
const target = targets.find(t => t.url.startsWith('http://127.0.0.1:3000'));
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, {once:true}));
const expression = `(() => {
  const canvases = [...document.querySelectorAll('canvas')];
  return {draws:window.__draws,canvases:canvases.map(c => {
    const path = [];
    let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber'))];
    while(f) {
      if(f.memoizedProps?.frameloop) path.push({name:f.type?.name,frameloop:f.memoizedProps.frameloop});
      if(f.memoizedProps?.active !== undefined) path.push({name:f.type?.name,active:f.memoizedProps.active});
      f=f.return;
    }
    return {id:c.dataset.perfCanvas,top:c.getBoundingClientRect().top,path};
  })};
})()`;
socket.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,returnByValue:true}}));
socket.addEventListener('message', ({data})=>{
  console.log(data);
  socket.close();
});
