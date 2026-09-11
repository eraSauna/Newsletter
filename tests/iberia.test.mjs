import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PROFILES, MARKET_QUERIES } from '../config.mjs';
import { blocksForDate } from '../lib/cadence.mjs';

const calls = [];
mock.module('../lib/gemini.mjs', { namedExports: {
  parseJsonArray: JSON.parse,
  geminiCall: async (args) => {
    calls.push(args);
    if (args.label.startsWith('collect:')) return { text: JSON.stringify([{title:'Nieuw saunaproject',url:`https://example.org/${encodeURIComponent(args.label)}`,snippet:'Nieuwe publieke buitensauna'}]) };
    if (args.label === 'filter') return {text:'[{"i":0,"keep":true,"dup_of":null}]'};
    if (args.label === 'read') return {text:'{"relevant":true,"title":"Nieuwe sauna","block":"competitors","score":75}'};
    if (args.label === 'audit') return {text:'{"missed":true,"reason":"nieuwe concurrent"}'};
    throw Error(args.label);
  }
}});
mock.module('../lib/util.mjs', { namedExports: {
  resolveFinalUrl: async url => url,
  fetchText: async () => 'Nieuwe publieke drop-in sauna in Spanje, aangekondigd september 2026.',
  mapLimit: async (items, limit, fn) => Promise.all(items.map(fn))
}});
const { collect } = await import('../lib/collect.mjs');
const { filterCandidates } = await import('../lib/filter.mjs');
const { readItems } = await import('../lib/read.mjs');
const { auditRejected } = await import('../lib/audit.mjs');

test('Iberia scope reaches collection, selection, verification and audit', async () => {
  const profile=PROFILES.iberia;
  assert.deepEqual(profile.markets,['Spanje','Portugal']);
  assert.equal(profile.language,'Nederlands');
  assert.equal(profile.trendwatch,false);
  assert.equal(new Set(Object.values(PROFILES).map(p=>p.memoryDir)).size,4);
  assert.deepEqual(PROFILES.main.markets,['Nederland','België','Frankrijk','Duitsland']);
  for(const market of profile.markets) assert.ok(MARKET_QUERIES[market]);
  const candidates=await collect({...profile,filterModel:'mock'});
  assert.ok(candidates.length>=4);
  assert.ok(calls.every(c=>!c.label.includes('trendwatch')));
  for (const c of calls) {assert.ok(c.prompt.includes(profile.focus));assert.ok(c.prompt.includes('ES|PT'));}
  const {kept}=await filterCandidates({candidates:[candidates[0]],model:'mock',focus:profile.focus});
  assert.equal(kept.length,1);
  const findings=await readItems({items:kept,model:'mock',focus:profile.focus});
  assert.equal(findings.length,1);
  const audit=await auditRejected({rejected:kept,size:1,model:'mock',focus:profile.focus});
  assert.equal(audit.missed.length,1);
  for(const c of calls.filter(c=>c.system)) {assert.ok(c.system.includes('ES/PT'));assert.ok(c.system.includes(profile.focus));}
  const active=blocksForDate(new Date('2026-09-14T06:00:00Z')).active;
  assert.ok(profile.sectionKeys.every(key=>active.some(b=>b.key===key)));
  assert.equal(profile.sectionKeys[1],'competitors');
  const prompt=await readFile(new URL('../'+profile.promptFile,import.meta.url),'utf8');
  assert.ok(prompt.includes('geen nieuwe vergelijkbare'));
});
