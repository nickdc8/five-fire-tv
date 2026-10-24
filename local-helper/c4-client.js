(() => {
 const panel=document.createElement('section');panel.style.cssText='border-top:1px solid #45503d;margin:24px 0;padding-top:20px';
 panel.innerHTML='<h2>Channel 4 connection</h2><p id="c4-state">Live playback ready to test.</p><p class="note">Requests Channel 4’s current live stream and uses normal Widevine playback. No account session has been transferred for this test.</p><button type="button" id="c4-play">Watch Channel 4</button>';
 document.getElementById('fields').before(panel);
 async function update(){try{const data=await(await fetch('/api/c4/status')).json();document.getElementById('c4-state').textContent=data.stage+(data.lastError?' · '+data.lastError:'')}catch{document.getElementById('c4-state').textContent='Local Channel 4 helper unavailable'}}
 window.FiveC4={async tune(token){
  const stale=()=>token!==generation;
  function failC4(title,detail){if(stale())return;clearTimeout(watchdog);status(title,detail,true);update()}
  status('Connecting to Channel 4…','Requesting the current live stream.');
  try{
   if(!navigator.requestMediaKeySystemAccess)throw new Error('Use desktop Chrome with protected playback enabled for this test.');
   await navigator.requestMediaKeySystemAccess('com.widevine.alpha',[{initDataTypes:['cenc'],videoCapabilities:[{contentType:'video/mp4; codecs="avc1.4D401F"'}],audioCapabilities:[{contentType:'audio/mp4; codecs="mp4a.40.2"'}]}]);if(stale())return;
   const state=await(await fetch('/api/status')).json();if(stale())return;
   const response=await fetch('/api/c4/play',{method:'POST',headers:{'X-Five-Key':state.code}});const playback=await response.json();if(stale())return;if(!response.ok)throw new Error(playback.error||'Channel 4 could not supply a stream');
   dash=dashjs.MediaPlayer().create();dash.updateSettings({debug:{logLevel:0}});dash.setProtectionData({'com.widevine.alpha':{serverURL:new URL(playback.licence,location.origin).href,httpRequestHeaders:{'X-Five-Key':state.code},withCredentials:false}});
   dash.on(dashjs.MediaPlayer.events.ERROR,event=>{if(!stale())failC4('Channel 4 playback failed','The stream arrived but playback failed'+(event.error?.code?' (player code '+event.error.code+')':'')+'. Open Menu → Settings for the last connection stage.')});
   dash.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED,()=>{if(!stale())play()});
   dash.initialize(v,playback.manifest,true);watchdog=setTimeout(()=>failC4('Channel 4 connection timed out','Video did not start. Open Menu → Settings for the last completed connection stage.'),30000);
   update();
  }catch(e){failC4('Channel 4 connection failed',e.message)}
 }};
 document.getElementById('c4-play').onclick=()=>{sample=false;document.getElementById('demo').checked=false;document.getElementById('settings').close();started=true;tune(3)};
 document.getElementById('setup').addEventListener('click',update);update();
})();
