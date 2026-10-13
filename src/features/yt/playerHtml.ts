import { timing } from './types';
// IDs are validated by callers and still JSON encoded. No pasted text or oEmbed
// HTML is interpolated into the page. YouTube UI/branding/ads remain unobscured.
export function playerHtml(videoId: string | null, playlistId: string | null = null) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"></head><body style="margin:0"><div id="player"></div><script>
  var player, ready=false, lastPlaylist='', timer;
  function send(data){window.ReactNativeWebView.postMessage(JSON.stringify(data));}
  function sample(){if(!ready)return;try{
    send({type:'sample',pos:player.getCurrentTime(),duration:player.getDuration(),state:player.getPlayerState(),rates:player.getAvailablePlaybackRates()});
    ${playlistId ? `var ids=player.getPlaylist()||[];if(ids.length&&JSON.stringify(ids)!==lastPlaylist){lastPlaylist=JSON.stringify(ids);send({type:'playlist',ids:ids.slice(0,50)});}` : ''}
  }catch(e){}}
  function onYouTubeIframeAPIReady(){player=new YT.Player('player',{width:'100%',height:window.innerHeight,videoId:${JSON.stringify(videoId ?? '')},playerVars:{enablejsapi:1,playsinline:1,controls:1,autoplay:0,fs:0,origin:'https://www.youtube.com'},events:{
    onReady:function(){ready=true;${playlistId ? `player.cuePlaylist({listType:'playlist',list:${JSON.stringify(playlistId)}});` : `player.cueVideoById(${JSON.stringify(videoId ?? '')});`}send({type:'ready'});timer=setInterval(sample,${timing.sample});},
    onStateChange:sample,onError:function(e){send({type:'error',code:e.data});},onPlaybackRateChange:sample
  }});}
  function receive(event){try{var c=JSON.parse(event.data);if(!ready)return;
    if(c.action==='play')player.playVideo();if(c.action==='pause')player.pauseVideo();
    if(c.action==='seek'&&Number.isFinite(c.value))player.seekTo(Math.max(0,c.value),true);
    if(c.action==='rate'&&Number.isFinite(c.value))player.setPlaybackRate(c.value);
  }catch(e){}}
  document.addEventListener('message',receive);window.addEventListener('message',receive);
  window.addEventListener('resize',function(){if(player&&player.setSize)player.setSize(window.innerWidth,window.innerHeight);});
  var script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=function(){send({type:'error',code:0});};document.head.appendChild(script);
  </script></body></html>`;
}
export function playerError(code: number) {
  if (code === 101 || code === 150) return 'This creator disabled embedding. Skip to the next video.';
  if (code === 100) return 'This video is private, removed or unavailable. Skip to the next video.';
  if (code === 153) return 'YouTube could not verify this embedded player. Retry or skip this video.';
  if (code === 2) return 'YouTube rejected this video or playlist id. Choose another link.';
  if (code === 5) return 'YouTube cannot play this video on this device. Retry or skip.';
  return 'YouTube could not load. Check your connection and retry or skip.';
}
