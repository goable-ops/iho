import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker.js';

const origin = 'https://iho.co.nz';
const fixture = { name:'Fictional Person',email:'fictional@example.invalid',trust:'Example Trust',
  region:'Bay of Plenty',role:'Trustee',message:'Fictional enquiry',updates_opt_in:false,turnstile_token:'fixture' };

test('existing site assets are delegated and intake fails closed without bindings', async () => {
  const env = { ASSETS:{ fetch: request => new Response(new URL(request.url).pathname) } };
  assert.equal(await (await worker.fetch(new Request(origin),env)).text(),'/');
  assert.equal((await worker.fetch(new Request(origin+'/api/join'),env)).status,405);
  assert.equal((await worker.fetch(new Request(origin+'/api/join',{method:'POST'}),env)).status,503);
});

test('intake validates origin, payload and Turnstile and stores the record and audit atomically', async t => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(process.env.IHO_INTAKE_SCHEMA ?? new URL('./intake-schema.sql',import.meta.url),'utf8'));
  let challenge = {success:true,hostname:'iho.co.nz',action:'iho_join'};
  t.mock.method(globalThis,'fetch',async () => Response.json(challenge));
  const env = {TURNSTILE_SECRET_KEY:'test-secret', IHO_INTAKE_DB:{
    prepare(sql){ return {bind:(...values)=>()=>sqlite.prepare(sql).run(...values)}; },
    async batch(statements){
      sqlite.exec('BEGIN');
      try { statements.forEach(statement=>statement()); sqlite.exec('COMMIT'); }
      catch(error){sqlite.exec('ROLLBACK');throw error;}
    }
  }};
  const submit = (body, from=origin) => worker.fetch(new Request(origin+'/api/join',{
    method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)
  }),env);
  assert.equal((await submit(fixture,'https://example.invalid')).status,403);
  assert.equal((await submit(null)).status,400);
  assert.equal((await submit({...fixture,message:'x'.repeat(13000)})).status,413);
  assert.equal((await submit({...fixture,updates_opt_in:'yes'})).status,400);
  challenge.action='different_form';
  assert.equal((await submit(fixture)).status,403);
  challenge.action='iho_join';
  sqlite.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON iho_interest_events BEGIN SELECT RAISE(ABORT,'fixture'); END");
  assert.equal((await submit(fixture)).status,503);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM iho_interest_enquiries').get().n,0);
  sqlite.exec('DROP TRIGGER fail_audit');
  assert.equal((await submit(fixture)).status,201);
  assert.equal((await submit({...fixture,updates_opt_in:true})).status,200);
  assert.equal((await submit({...fixture,email:'second@example.invalid',updates_opt_in:true})).status,201);
  const rows=sqlite.prepare('SELECT email,updates_opt_in,updates_opt_in_at,next_followup_at FROM iho_interest_enquiries ORDER BY email').all();
  assert.equal(rows.length,2);
  assert.equal(rows[0].updates_opt_in,0);
  assert.equal(rows[0].updates_opt_in_at,null);
  assert.equal(rows[1].updates_opt_in,1);
  assert.ok(rows[1].updates_opt_in_at);
  assert.ok(rows.every(row=>row.next_followup_at));
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM iho_interest_events').get().n,2);
  sqlite.close();
});
