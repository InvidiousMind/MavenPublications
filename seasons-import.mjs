import {stat, readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';

const [base, media, deduction, player, host] = process.argv.slice(2);
if (!base || !media || !deduction || !player || !host || !process.env.MAVEN_ADMIN_COOKIE) {
  throw Error('Usage: MAVEN_ADMIN_COOKIE=<admin session cookie> node seasons-import.mjs <website origin> <V05 media dir> <deduction media dir> <player PDF dir> <private host PDF dir>');
}
const origin = new URL(base).origin;
const episode = 'S0001_E01';
const playlist = JSON.parse(await readFile(join(media,'MAVEN_MYSTERY_MEDIA_LIBRARY_APP_HANDOFF_V05.json'),'utf8'));
const catalog = JSON.parse(await readFile(join(media,'MAVEN_MYSTERY_GLOBAL_TITLE_CARDS_CATALOG_V05.json'),'utf8'));
const announcements = JSON.parse(await readFile(join(media,'MAVEN_MYSTERY_GLOBAL_ANNOUNCEMENT_PLACEHOLDERS_APP_MANIFEST_V01.json'),'utf8'));
const outcomes = JSON.parse(await readFile(join(deduction,'MAVEN_MYSTERY_GLOBAL_DEDUCTION_Manifest.json'),'utf8'));
const assets = new Map();
function add(group, directory, filename, name=filename) {
  assets.set(group+'/'+name,{group,directory,filename,name});
}
for (const clip of playlist.entries) add(clip.scope==='shared'?'shared':'episode',media,clip.filename);
for (const clip of catalog.entries) add('shared',media,clip.filename);
for (const clip of announcements.entries) {
  add('shared',media,clip.filename);
  add('shared',media,clip.transcript_filename);
}
for (const clip of outcomes.clips) {
  add('shared',deduction,clip.file);
  add('shared',deduction,clip.transcript);
}
for (const filename of await readdir(media)) {
  if (filename.endsWith('Final_Transcript_V05.txt')||filename==='MAVEN_SPY_GLASS_MUSIC_CREDIT.txt') add('episode',media,filename);
}
for (const [source,name] of [['Start_Here','start'],['Evidence_Audit','audit'],['Investigation_Journals','journals'],
  ...Array.from({length:6},(_,i)=>['Case_File_0'+(i+1),'case-'+(i+1)])]) {
  add('episode',player,'MAVEN_MYSTERY_S0001_E01_HIGH_VALUE_THEFT_'+source+'.pdf',name+'.pdf');
}
for (const [source,name] of [['Master_Solution','solution'],['Host_Briefing_Guide','host-guide']]) {
  add('episode',host,'MAVEN_MYSTERY_S0001_E01_HIGH_VALUE_THEFT_'+source+'_Playtest.pdf',name+'.pdf');
}
for (const asset of assets.values()) {
  const metadata = await stat(join(asset.directory,asset.filename));
  if (!metadata.isFile()||metadata.size<1||metadata.size>50*1024*1024) throw Error('Invalid asset: '+asset.filename);
}
for (const {group,directory,filename,name} of assets.values()) {
  const response = await fetch(origin+'/api/seasons/admin/asset?'+new URLSearchParams({group,slot:episode,name}),{
    method:'POST',headers:{origin,cookie:process.env.MAVEN_ADMIN_COOKIE},body:await readFile(join(directory,filename))
  });
  if (!response.ok) throw Error(name+' upload failed ('+response.status+'): '+await response.text());
  console.log('Imported',group,name);
}
