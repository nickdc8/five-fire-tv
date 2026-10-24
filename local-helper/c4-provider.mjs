import {createDecipheriv,randomBytes} from 'node:crypto';
const LICENSE='https://c4.eme.lp.aws.redbeemedia.com/wvlicenceproxy-service/widevine/acquire';
const browserHeaders={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',Origin:'https://www.channel4.com',Referer:'https://www.channel4.com/'};
// These constants unwrap Channel 4's browser playback token. They are not video/CDM keys.
const tokenKey=Buffer.from('n9cLieYkqwzNCqvi'),tokenIv=Buffer.from('odzcU3WdUiXLucVd');
const sessions=new Map();
let stage='Not requested',lastError=null;
export const getStatus=()=>({stage,lastError});
async function request(url,options={}){const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(18000)});if(!response.ok){const e=new Error(`Channel 4 returned HTTP ${response.status}`);e.status=response.status;throw e}return response}
export async function getPlaylist(){try{
 stage='Requesting Channel 4 live playlist';lastError=null;
 const info=await(await request('https://www.channel4.com/simulcast/channels/c4',{headers:browserHeaders})).json();
 const profiles=(info.channelInfo??info).videoProfiles;
 const profile=profiles?.find(p=>p.name==='dashwv-live-stream-iso-dash-sp-tl');
 const stream=profile?.streams?.[0];if(!stream?.uri||!stream?.token)throw new Error('Channel 4 returned no supported live stream');
 const url=new URL(stream.uri);if(url.protocol!=='https:'||url.port||url.username||url.password||!url.hostname.endsWith('.c4assets.com'))throw new Error('Unexpected Channel 4 manifest endpoint');
 const decipher=createDecipheriv('aes-128-cbc',tokenKey,tokenIv);
 const wrapped=Buffer.concat([decipher.update(Buffer.from(stream.token,'base64')),decipher.final()]).toString('utf8');
 const token=wrapped.match(/&t=(.+)$/)?.[1]??wrapped.split('|')[1];if(!token)throw new Error('Channel 4 playback token format changed');
 for(const [id,s]of sessions)if(s.expiry<Date.now())sessions.delete(id);
 while(sessions.size>=8)sessions.delete(sessions.keys().next().value);
 const id=randomBytes(16).toString('hex');sessions.set(id,{manifest:url.href,token,expiry:Date.now()+10*60*1000});
 stage='Channel 4 playlist received; awaiting DRM licence';return{manifest:url.href,drm:true,licence:'/api/c4/licence/'+id};
 }catch(e){lastError=e.message.startsWith('Channel 4')||e.message.startsWith('Unexpected')?e.message:'Channel 4 request failed or timed out';throw new Error(lastError)}}
export async function getLicence(id,challenge){try{
 const session=sessions.get(id);if(!session||session.expiry<Date.now())throw new Error('Channel 4 playback request expired; select channel 4 again');
 stage='Requesting Channel 4 DRM licence';lastError=null;
 const payload={token:session.token,video:{type:'simulcast',url:session.manifest},message:challenge.toString('base64')};
 const response=await request(LICENSE,{method:'POST',headers:{...browserHeaders,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const result=await response.json();if(typeof result.license!=='string'||!result.license.length)throw new Error('Channel 4 returned no DRM licence');
 stage='Channel 4 DRM licence received';return Buffer.from(result.license,'base64');
 }catch(e){lastError=e.message.startsWith('Channel 4')?e.message:'Channel 4 licence request failed or timed out';throw new Error(lastError)}}
