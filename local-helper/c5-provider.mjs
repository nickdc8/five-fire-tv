import {createHmac,createDecipheriv,randomBytes} from 'node:crypto';
const PLAYER='https://player.akamaized.net/html5player/core/html5-c5-player.js';
const browserHeaders={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',Origin:'https://www.channel5.com',Referer:'https://www.channel5.com/'};
let constants=null,stage='Not requested',lastError=null;
const sessions=new Map();
export const getStatus=()=>({stage,lastError});
function safeUrl(raw,domains){const u=new URL(raw);if(u.protocol!=='https:'||u.port||u.username||u.password||!domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))throw new Error('Unexpected Channel 5 endpoint: '+u.hostname);return u.href}
async function request(url,options={}){const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(18000)});if(!response.ok){const e=new Error(`Channel 5 returned HTTP ${response.status}`);e.status=response.status;e.hmac=response.status===403&&(await response.text()).includes('Failed to authenticate HMAC');throw e}return response}
async function getConstants(force=false){if(constants&&!force&&constants.expires>Date.now())return constants.values;
 stage='Reading Channel 5 browser configuration';
 const js=await(await request(PLAYER,{headers:browserHeaders})).text();
 const seed=js.match(/;\}\}\}\)\('(......)'\)\};/)?.[1];const encoded=js.match(/\(\)\{return "(.{3000,})";\}/)?.[1];if(!seed||!encoded)throw new Error('Channel 5 player configuration format changed');
 const decoded=decodeURIComponent(encoded);let plain='';for(let i=0;i<decoded.length;i++){const c=decoded.charCodeAt(i)^seed.charCodeAt(i%6);if(c>31&&c<127)plain+=String.fromCharCode(c)}
 // Browser transport constants sign requests and unwrap JSON; no video/CDM keys are read.
 const values=[...plain.matchAll(/(?:[\W_][\W_]|^)([A-Za-z0-9+/]{22}==)(?=[\W_][\W_]|$)/g)].map(m=>Buffer.from(m[1],'base64'));
 if(values.length!==2||values.some(b=>b.length!==16))throw new Error('Channel 5 browser transport configuration changed');constants={values,expires:Date.now()+30*60*1000};return values}
async function getMedia(force=false){const values=await getConstants(force);
 for(let order=0;order<2;order++){
  const aes=values[order],hmac=values[1-order];
  const base='https://cassie.channel5.com/api/v2/live_media/my5desktopng/C5.json?timestamp='+Math.floor(Date.now()/1000);
  const url=base+'&auth='+createHmac('sha256',hmac).update(base).digest('base64url');
  try{stage='Requesting Channel 5 live playlist';const encrypted=await(await request(url,{headers:browserHeaders})).json();if(typeof encrypted.iv!=='string'||typeof encrypted.data!=='string')throw new Error('Channel 5 returned an unexpected playback response');const decipher=createDecipheriv('aes-128-cbc',aes,Buffer.from(encrypted.iv,'base64url'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.data,'base64url')),decipher.final()]).toString('utf8'));}
  catch(e){if(e.hmac&&order===0)continue;if(e.hmac&&!force)return getMedia(true);throw e}
 }}
export async function getPlaylist(){try{
 lastError=null;const data=await getMedia();const asset=data.assets?.find(a=>a.drm==='widevine');if(!asset?.renditions?.[0]?.url||!asset.keyserver)throw new Error('Channel 5 returned no Widevine live stream');
 const manifest=safeUrl(asset.renditions[0].url,['akamaized.net','channel5.com','dai.google.com']);const licence=safeUrl(asset.keyserver,['cassie.channel5.com']);
 if(!new URL(licence).pathname.startsWith('/api/v2/licences/widevine/'))throw new Error('Unexpected Channel 5 licence endpoint');
 for(const [id,s]of sessions)if(s.expires<Date.now())sessions.delete(id);while(sessions.size>=8)sessions.delete(sessions.keys().next().value);
 const id=randomBytes(16).toString('hex');const expiry=Number(new URL(licence).searchParams.get('expiry'))*1000;sessions.set(id,{licence,expires:expiry>Date.now()?Math.min(expiry,Date.now()+60*60*1000):Date.now()+10*60*1000});
 stage='Channel 5 playlist received; awaiting DRM licence';return{manifest,drm:true,licence:'/api/c5/licence/'+id};
 }catch(e){lastError=e.message.startsWith('Channel 5')||e.message.startsWith('Unexpected')?e.message:'Channel 5 playback request failed or timed out';throw new Error(lastError)}}
export async function getLicence(id,challenge){try{
 const session=sessions.get(id);if(!session||session.expires<Date.now())throw new Error('Channel 5 playback request expired; select channel 5 again');
 stage='Requesting Channel 5 DRM licence';lastError=null;const response=await request(session.licence,{method:'POST',headers:{...browserHeaders,'Content-Type':'application/octet-stream'},body:challenge});const licence=Buffer.from(await response.arrayBuffer());if(!licence.length)throw new Error('Channel 5 returned an empty DRM licence');stage='Channel 5 DRM licence received';return licence;
 }catch(e){lastError=e.message.startsWith('Channel 5')?e.message:'Channel 5 licence request failed or timed out';throw new Error(lastError)}}
