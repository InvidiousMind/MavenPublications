import { journals } from './seasons-journals.mjs';
const episode = 'S0001_E01';
export function yearFromNow() {
  const date = new Date();
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear()+1);
  if (date.getUTCMonth()!==month) date.setUTCDate(0);
  return date.getTime();
}
const roomLifetime = 86400000;
const prefix = '/api/seasons/';
const headers = {'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const json = (data, status = 200) => Response.json(data, {status, headers});
const error = (message, status = 400) => json({error:message}, status);
const token = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2,'0')).join('');
const outcomes = ['CORRECT','WRONG_RETRY','CONVICT_ANYWAY'];
const fileNumbers = [1,2,3,4,5,6];
const documentSlots = ['start','audit','journals','solution','host-guide',...fileNumbers.map(n=>'case-'+n)];
const assetPattern = /^[a-zA-Z0-9_-]+\.(mp4|txt|json|pdf|html)$/;
const isOpen = room => room && room.expires > Date.now();
const canReadFile = (room, guest, file) => !!guest && guest.files.includes(file) && room.phase !== 'briefing';
const publicRoom = (room, guest, host) => ({
  phase:room.phase, code:room.code, briefing:room.briefing, audit:room.audit,
  outcome:room.outcome, reveal:room.reveal, reaction:room.reaction, expires:room.expires,
  ...(host ? {players:room.players.map(({id,name,files,journals})=>({id,name,files,journals:Object.fromEntries(Object.entries(journals).map(([key,value])=>[key,value.complete]))}))}
    : {player:{name:guest.name,files:room.phase==='briefing'?[]:guest.files,journals:Object.fromEntries(Object.entries(guest.journals).filter(([file])=>guest.files.includes(Number(file)))),prompts:room.phase==='briefing'?{}:Object.fromEntries(guest.files.map(file=>[file,journals[file-1][2]]))}})
});

export async function seasonsHostAccess(db, session) {
  if (session?.role !== 'customer') return null;
  const grant = await db.get('seasons:host:'+session.userId);
  return grant?.expires > Date.now() && !grant.revoked ? grant : null;
}

export async function seasonsProductAccess(db, session) {
  if (session?.role !== 'customer') return null;
  const grant = await db.get('seasons:product:'+session.userId);
  return grant?.expires > Date.now() && !grant.revoked ? grant : null;
}

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), n=>alphabet[n % alphabet.length]).join('');
}

function storageKey(group, name, slot) {
  if (!assetPattern.test(name)) return null;
  if (group === 'shared' && /\.(mp4|txt|json)$/.test(name)) return 'shared/'+name;
  if (group === 'episode' && /^S\d{4}_E\d{2}$|^special-[a-z0-9-]+$/.test(slot)) return slot+'/'+name;
  return null;
}

async function fileResponse(bucket, key, request) {
  const range = key.endsWith('.mp4') ? request.headers.get('range') : null;
  let object;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const meta = await bucket.head(key);
    if (!meta) return error('File unavailable.',404);
    const start = match?.[1] ? Number(match[1]) : Math.max(0,meta.size-Number(match?.[2]));
    const end = match?.[1] && match[2] ? Math.min(Number(match[2]),meta.size-1) : meta.size-1;
    if (!match || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= meta.size) {
      return new Response(null,{status:416,headers:{...headers,'content-range':'bytes */'+meta.size}});
    }
    object = await bucket.get(key,{range:{offset:start,length:end-start+1}});
    if (!object) return error('File unavailable.',404);
    return new Response(object.body,{status:206,headers:{...headers,'accept-ranges':'bytes','content-type':object.httpMetadata.contentType,'content-length':String(end-start+1),'content-range':`bytes ${start}-${end}/${meta.size}`}});
  }
  object = await bucket.get(key);
  if (!object) return error('File unavailable.',404);
  return new Response(object.body,{headers:{...headers,'accept-ranges':'bytes','content-type':object.httpMetadata.contentType,'content-length':String(object.size),
    ...(key.endsWith('.html')?{'content-security-policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'"}:{})}});
}

export async function seasonsRoute(vault, request) {
  try {
    return await route({db:vault.db,env:vault.env,session:vault.session.bind(vault),limited:vault.limited.bind(vault)},request);
  } catch (cause) {
    if (cause instanceof SyntaxError) return error('Invalid request.');
    console.error('Mystery Seasons request failed',cause);
    return error('Mystery Seasons is temporarily unavailable.',503);
  }
}

async function route({db,env,session:readSession,limited},request) {
  const url = new URL(request.url);
  const action = url.pathname.slice(prefix.length);
  const post = request.method === 'POST';
  if (post && request.headers.get('origin')!==url.origin) return error('Request origin rejected.',403);
  if (!post && request.method !== 'GET') return error('Method not allowed.',405);
  const session = await readSession(request);
  const bucket = env.SEASONS_MEDIA;
  if (action.startsWith('admin/')) {
    if (session?.role !== 'admin') return error('Admin access required.',403);
    if (action === 'admin/asset') {
      const key = storageKey(url.searchParams.get('group'),url.searchParams.get('name')||'',url.searchParams.get('slot')||'');
      const length = Number(request.headers.get('content-length'));
      if (!bucket) return error('Private media storage is not configured.',503);
      if (!key) return error('Invalid file location.');
      if (!post) return json({uploaded:!!await bucket.head(key)});
      if (!request.body || !Number.isSafeInteger(length) || length < 1 || length > 50*1024*1024) return error('Choose a supported file under 50 MB.');
      const types = {mp4:'video/mp4',pdf:'application/pdf',txt:'text/plain; charset=utf-8',json:'application/json',html:'text/html; charset=utf-8'};
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength!==length) return error('Incomplete file upload.');
      await bucket.put(key,bytes,{httpMetadata:{contentType:types[key.split('.').pop()]}});
      return json({ok:true});
    }
    if (!post || !['admin/grant','admin/code'].includes(action)) return error('Unknown admin action.',404);
    const data = await request.json();
    if (action === 'admin/code') {
      const code = 'MAVEN-HOST-'+token().toUpperCase();
      await db.put('seasons:code:'+await digest(code),{episode,created:Date.now()});
      return json({code});
    }
    if (!/^[a-f0-9]{48}$/.test(data.member||'') || !await db.get('account:'+data.member)) return error('Member account not found.',404);
    if (data.status === true) return json({grant:await seasonsHostAccess(db,{role:'customer',userId:data.member})});
    if (data.revoke === true) {
      await db.delete('seasons:host:'+data.member);
      return json({ok:true});
    }
    const expires = yearFromNow();
    await db.put('seasons:host:'+data.member,{episode,expires});
    return json({expires});
  }
  if (action === 'product' && !post) {
    if (!await seasonsProductAccess(db,session)) return error('Active Episode 1 product access required.',403);
    const {briefing, transcript, credit} = await import('./seasons-content.mjs');
    const clips = briefing.filter(clip=>clip.review_after_briefing);
    const name = url.searchParams.get('name');
    if (!name) return json({clips,transcript,credit});
    const playerFiles = ['start.pdf','journals.pdf',...fileNumbers.map(n=>'case-'+n+'.pdf'),transcript,credit];
    if (!playerFiles.includes(name) && !clips.some(clip=>clip.filename===name)) {
      return error('This material is restricted.',403);
    }
    return bucket ? fileResponse(bucket,episode+'/'+name,request) : error('Private media storage is not configured.',503);
  }
  if (action === 'redeem' && post) {
    if (await limited(request,'seasons-redeem')) return error('Too many attempts. Try again later.',429);
    if (session?.role !== 'customer') return error('Sign in to redeem host access.',401);
    const {code} = await request.json();
    if (!/^MAVEN-HOST-[A-F0-9]{64}$/.test(code||'')) return error('Invalid host code.');
    const key = 'seasons:code:'+await digest(code);
    const expires = await db.transaction(async tx=>{
      const entry = await tx.get(key);
      if (!entry || (entry.member && entry.member!==session.userId)) return null;
      if (entry.member) return entry.expires;
      const until = yearFromNow();
      await tx.put(key,{...entry,member:session.userId,expires:until});
      await tx.put('seasons:host:'+session.userId,{episode,expires:until});
      return until;
    });
    return expires ? json({expires,destination:'/mystery-seasons-game?host=1'}) : error('Invalid or already redeemed host code.',403);
  }
  const grant = await seasonsHostAccess(db,session);
  if (action === 'create' && post) {
    if (!grant) return error('Active Episode 1 host access required.',403);
    for (let attempt=0;attempt<8;attempt++) {
      const code = roomCode();
      const room = {code,host:session.userId,expires:Date.now()+roomLifetime,phase:'briefing',briefing:'ready',audit:false,reveal:false,players:[]};
      const created = await db.transaction(async tx=>{
        if (isOpen(await tx.get('seasons:room:'+code))) return false;
        await tx.put('seasons:room:'+code,room);
        return true;
      });
      if (created) return json({code});
    }
    return error('Could not create a room. Try again.',503);
  }
  const code = (url.searchParams.get('room')||'').toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) return error('Enter a six-character room code.');
  const key = 'seasons:room:'+code;
  if (action === 'join' && post) {
    if (await limited(request,'seasons-join')) return error('Too many joins. Try again later.',429);
    const data = await request.json();
    const name = typeof data.name==='string'?data.name.trim():'';
    const rejoin = typeof data.rejoin==='string' ? data.rejoin.trim().toUpperCase() : '';
    const legacy = /^[A-F0-9]{64}$/.test(rejoin);
    if (rejoin ? !legacy && !/^[A-HJ-NP-Z2-9]{6}$/.test(rejoin) : !name || name.length>60) {
      return error('Enter a name or a valid private rejoin code.');
    }
    const secret = token();
    const credential = await digest(secret);
    const lookup = rejoin ? await digest(legacy ? rejoin.toLowerCase() : code+':'+rejoin) : null;
    const result = await db.transaction(async tx=>{
      const room = await tx.get(key);
      if (!isOpen(room)) return {error:'Room not available.'};
      let player;
      if (rejoin) {
        player = room.players.find(p=>legacy ? !p.rejoin && p.credential===lookup : p.rejoin===lookup);
        if (!player) return {error:'Rejoin code not recognised.'};
      } else {
        if (room.phase==='closed' || room.players.length>=6) return {error:'This room is closed or full.'};
        player = {id:crypto.randomUUID(),name,files:[],journals:{}};
        room.players.push(player);
      }
      let privateCode = legacy ? '' : rejoin;
      if (!privateCode) {
        for (let attempt=0;attempt<8;attempt++) {
          const candidate = roomCode(), hash = await digest(code+':'+candidate);
          if (candidate!==code && !room.players.some(p=>p.rejoin===hash)) {
            privateCode = candidate;
            player.rejoin = hash;
            break;
          }
        }
        if (!privateCode) return {error:'Could not issue a rejoin code. Try again.'};
      }
      player.credential = credential;
      await tx.put(key,room);
      return {privateCode};
    });
    return result.error ? error(result.error,403) : new Response(JSON.stringify({code,secret,rejoin:result.privateCode}),{
      headers:{...headers,'content-type':'application/json','set-cookie':'seasons_guest_'+code+'='+secret+'; Path=/api/seasons/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400'}
    });
  }
  const cookies = request.headers.get('cookie')||'';
  const credential = request.headers.get('x-room-credential') ||
    cookies.match(new RegExp('(?:^|; )seasons_guest_'+code+'=([a-f0-9]{64})(?:;|$)'))?.[1] ||
    cookies.match(/(?:^|; )seasons_guest=([a-f0-9]{64})(?:;|$)/)?.[1] || '';
  const guestHash = /^[a-f0-9]{64}$/.test(credential) ? await digest(credential) : null;
  const identify = room=>({
    host:!!grant && session.userId===room.host,
    guest:guestHash ? room.players.find(p=>p.credential===guestHash) : null
  });
  if (!post) {
    const room = await db.get(key);
    if (!isOpen(room)) return error('Room not available.',404);
    const {host,guest} = identify(room);
    if (!host&&!guest) return error('Join this room first.',403);
    if (action==='state') return json(publicRoom(room,guest,host));
    if (action!=='asset') return error('Unknown room action.',404);
    const name = url.searchParams.get('name')||'';
    let objectKey;
    if (documentSlots.some(slot=>name===slot+'.pdf') || ['host.html','player.html','journals.json'].includes(name)) {
      const file = /^case-([1-6])\.pdf$/.exec(name);
      const allowed = ['solution.pdf','host-guide.pdf','host.html'].includes(name) ? host
        : file ? host || canReadFile(room,guest,Number(file[1]))
        : name==='audit.pdf' ? host || room.audit
        : ['journals.pdf','journals.json'].includes(name) ? host
        : true;
      if (!allowed) return error('This material is restricted.',403);
      objectKey = episode+'/'+name;
    } else {
      const selected = assetPattern.test(name);
      if (!selected) return error('Media unavailable.',404);
      const {briefing,reactionFiles,transcript,credit} = await import('./seasons-content.mjs');
      const clip = briefing.find(entry=>entry.filename===name);
      const reactionFile = reactionFiles[room.outcome];
      if (clip && (room.briefing==='playing' || (room.briefing==='shown' && clip.review_after_briefing))) {
        objectKey = (clip.scope==='shared'?'shared':episode)+'/'+name;
      } else if ((name===transcript && room.briefing==='shown') || name===credit) {
        objectKey = episode+'/'+name;
      } else if (reactionFile && name===reactionFile+'.txt') {
        objectKey = 'shared/'+name;
      } else if (reactionFile && name===reactionFile+'.mp4' && room.reaction.active) {
        objectKey = 'shared/'+name;
      } else {
        return error('This media is unavailable at this stage.',403);
      }
    }
    return bucket ? fileResponse(bucket,objectKey,request) : error('Private media storage is not configured.',503);
  }
  if (action!=='room') return error('Unknown room action.',404);
  const data = await request.json();
  return db.transaction(async tx=>{
    const room = await tx.get(key);
    if (!isOpen(room)) return error('Room not available.',404);
    const {host,guest} = identify(room);
    if (data.type==='journal') {
      if (!canReadFile(room,guest,data.file) || room.phase==='closed') return error('This journal is unavailable.',403);
      if (!Array.isArray(data.answers) || data.answers.length!==4 || data.answers.some(a=>typeof a!=='string'||a.length>4000)) return error('Send four journal responses.');
      const complete = data.complete===true && data.answers.every(a=>a.trim());
      guest.journals[data.file]={answers:data.answers,complete:!!complete};
    } else {
      if (!host) return error('Only the host can do that.',403);
      const covered = fileNumbers.every(n=>room.players.some(p=>p.files.includes(n)));
      switch (data.type) {
        case 'assign': {
          const player = room.players.find(p=>p.id===data.player);
          if (!player || room.phase==='closed' || !Array.isArray(data.files) || data.files.some(n=>!fileNumbers.includes(n))) return error('Choose an active player and case files.');
          const assigned = [...new Set(data.files)];
          for (const other of room.players) if (other!==player) other.files=other.files.filter(n=>!assigned.includes(n));
          player.files=assigned;
          if (room.phase!=='briefing' && !fileNumbers.every(n=>room.players.some(p=>p.files.includes(n)))) return error('Transfer those files directly to the replacement player so all six files remain assigned.',409);
          break;
        }
        case 'briefing':
          if (room.briefing!=='ready') return error('The briefing has already started.',409);
          room.briefing='playing';
          break;
        case 'briefing-shown':
          if (room.briefing!=='playing') return error('The briefing is not playing.',409);
          room.briefing='shown';
          break;
        case 'start':
          if (!covered || room.briefing!=='shown' || room.phase!=='briefing') return error('Complete the briefing and assign all six files.',409);
          room.phase='investigation';
          break;
        case 'audit':
          if (room.phase!=='investigation'||!covered) return error('Verify coverage of all six files first.',409);
          room.audit=true;
          break;
        case 'submit':
          if (room.phase!=='investigation'||!room.audit||!covered) return error('Complete the audit before receiving the deduction.',409);
          room.phase='deduction';
          break;
        case 'outcome':
          if (!outcomes.includes(data.outcome) || (room.phase!=='deduction' && !(room.phase==='feedback'&&room.outcome==='WRONG_RETRY'&&data.outcome==='WRONG_RETRY'))) return error('Outcome unavailable.',409);
          room.outcome=data.outcome;
          room.reaction={id:crypto.randomUUID(),active:true};
          room.phase=data.outcome==='WRONG_RETRY'?'feedback':'closed';
          break;
        case 'reaction-shown':
          if (!room.reaction || room.reaction.id!==data.id) return error('This reaction is no longer active.',409);
          room.reaction.active=false;
          break;
        case 'resume':
          if (room.phase!=='feedback') return error('The investigation cannot be resumed now.',409);
          room.phase='investigation';
          break;
        case 'reveal':
          if (room.phase!=='closed'||room.outcome!=='CORRECT') return error('Reveal is unavailable.',409);
          room.reveal=true;
          break;
        default: return error('Unknown room action.',404);
      }
    }
    await tx.put(key,room);
    return json(publicRoom(room,guest,host));
  });
}
