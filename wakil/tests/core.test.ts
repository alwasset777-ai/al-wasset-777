import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { AgentRunner, parseJSONLoose } from '../src/agent/engine';
import { fromAnthropic, fromGemini, fromOpenAI, setFetch, toAnthropic, toGemini, toOpenAI, type LLMRequest } from '../src/core/providers';
import { createTask, initStore, listFiles, normalizePath, saveSettings, scoreText } from '../src/core/store';
import { db } from '../src/core/db';
import type { Task } from '../src/core/types';

const req: LLMRequest = {
  model: { provider: 'gemini', model: 'gemini-2.5-flash' },
  system: 'SYS',
  messages: [
    { role: 'user', content: 'Bonjour' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'web_search', args: { query: 'x' } }] },
    { role: 'tool', content: 'résultat', toolCallId: 'c1', toolName: 'web_search' },
  ],
  tools: [{ name: 'web_search', description: 'd', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }],
};

describe('conversion des fournisseurs', () => {
  it('Gemini : rôles, appels et réponses d’outils', () => {
    const b: any = toGemini(req);
    expect(b.systemInstruction.parts[0].text).toBe('SYS');
    expect(b.contents.map((c: any) => c.role)).toEqual(['user', 'model', 'user']);
    expect(b.contents[1].parts[0].functionCall.name).toBe('web_search');
    expect(b.contents[2].parts[0].functionResponse.response.result).toBe('résultat');
    expect(b.tools[0].functionDeclarations[0].name).toBe('web_search');
    const r = fromGemini({ candidates: [{ content: { parts: [{ text: 'pensée', thought: true }, { text: 'OK' }, { functionCall: { name: 'f', args: { a: 1 } }, thoughtSignature: 'sig' }] } }] });
    expect(r.text).toBe('OK');
    expect(r.toolCalls[0]).toMatchObject({ name: 'f', args: { a: 1 } });
    expect((r.providerMeta as any[])[2].thoughtSignature).toBe('sig'); // renvoyé tel quel au tour suivant
  });
  it('OpenAI-compatible', () => {
    const b: any = toOpenAI({ ...req, model: { provider: 'groq', model: 'm' } }, 'groq');
    expect(b.messages[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(b.messages[2].tool_calls[0].function.arguments).toBe('{"query":"x"}');
    expect(b.messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
    const r = fromOpenAI({ choices: [{ message: { content: '<think>…</think>Salut', tool_calls: [{ id: 't', function: { name: 'g', arguments: '{"b":2}' } }] } }] });
    expect(r.text).toBe('Salut');
    expect(r.toolCalls[0].args).toEqual({ b: 2 });
  });
  it('Anthropic', () => {
    const b: any = toAnthropic({ ...req, model: { provider: 'anthropic', model: 'm' } });
    expect(b.system).toBe('SYS');
    expect(b.messages[1].content[0]).toMatchObject({ type: 'tool_use', id: 'c1' });
    expect(b.messages[2].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'c1' });
    const r = fromAnthropic({ content: [{ type: 'text', text: 'A' }, { type: 'tool_use', id: 'u', name: 'h', input: { c: 3 } }] });
    expect(r.toolCalls[0]).toEqual({ id: 'u', name: 'h', args: { c: 3 } });
  });
});

describe('utilitaires', () => {
  it('parseJSONLoose tolère le texte autour et les blocs ```', () => {
    expect(parseJSONLoose('Voici :\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJSONLoose('blabla {"ok": true, "s": "a}b"} fin')).toEqual({ ok: true, s: 'a}b' });
    expect(parseJSONLoose('rien')).toBeNull();
  });
  it('normalizePath bloque la remontée de dossiers', () => {
    expect(normalizePath('../../etc/passwd')).toBe('etc/passwd');
    expect(normalizePath('rapport/ma note.md')).toBe('rapport/ma note.md');
    expect(normalizePath('')).toBe('fichier.txt');
  });
  it('scoreText ignore les accents', () => {
    expect(scoreText('Préfère les rapports courts', 'prefere rapports')).toBe(1);
  });
});

describe('moteur d’agent (fournisseur simulé)', () => {
  beforeAll(async () => {
    await initStore();
    await saveSettings({ providers: { gemini: { enabled: true, apiKey: 'test-key' } }, defaultModel: { provider: 'gemini', model: 'gemini-2.5-flash' } });
  });

  it('planifie, exécute avec outils, vérifie et livre', async () => {
    const replies = [
      { text: '{"title":"Rapport test","steps":[{"title":"Écrire le rapport","detail":"créer rapport.md"}]}' }, // plan
      { call: { name: 'write_file', args: { path: 'rapport.md', content: '# Rapport\nContenu' } } }, // étape : outil
      { text: 'Fichier rapport.md créé.' }, // étape : fin
      { text: '{"ok":true,"notes":"Objectif atteint","fixes":[]}' }, // vérification
      { text: '## Résultat\nLe rapport est prêt : `rapport.md`.' }, // livraison
    ];
    const seen: any[] = [];
    setFetch((async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      seen.push(body);
      const r = replies.shift()!;
      const parts = r.call ? [{ functionCall: r.call }] : [{ text: r.text }];
      return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] }), { status: 200 });
    }) as typeof fetch);

    const task = await createTask({ goal: 'Écris un petit rapport' });
    const updates: Task[] = [];
    const runner = new AgentRunner(task, { model: { provider: 'gemini', model: 'gemini-2.5-flash' } }, { approve: async () => true, onUpdate: (t) => updates.push(t) });
    const done = await runner.run();

    expect(done.status).toBe('done');
    expect(done.title).toBe('Rapport test');
    expect(done.steps).toHaveLength(1);
    expect(done.steps[0].status).toBe('done');
    expect(done.verification?.ok).toBe(true);
    expect(done.result).toContain('rapport.md');
    expect(done.fileIds).toHaveLength(1);
    const files = await listFiles('');
    expect(files.find((f) => f.path === 'rapport.md')?.content).toContain('# Rapport');
    expect(seen[0].generationConfig.responseMimeType).toBe('application/json');
    expect(seen[1].tools[0].functionDeclarations.some((d: any) => d.name === 'write_file')).toBe(true);
    // le résultat d'outil est renvoyé au modèle au tour suivant
    expect(JSON.stringify(seen[2].contents)).toContain('functionResponse');
    expect(updates.some((u) => u.status === 'planning')).toBe(true);
    expect((await db.get<Task>('tasks', task.id))?.status).toBe('done');
  });

  it('ajoute des étapes de correction quand la vérification échoue', async () => {
    const replies = [
      '{"title":"T","steps":[{"title":"A","detail":""}]}',
      'A fait.',
      '{"ok":false,"notes":"il manque B","fixes":[{"title":"Ajouter B","detail":"faire B"}]}',
      'B fait.',
      '{"ok":true,"notes":"complet","fixes":[]}',
      'Final',
    ];
    setFetch((async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: replies.shift() }] } }] }), { status: 200 })) as typeof fetch);
    const task = await createTask({ goal: 'g' });
    const done = await new AgentRunner(task, { model: { provider: 'gemini', model: 'm' } }, { approve: async () => true }).run();
    expect(done.steps.map((s) => s.title)).toEqual(['A', 'Correction : Ajouter B']);
    expect(done.verification?.ok).toBe(true);
    expect(done.status).toBe('done');
  });

  it('signale clairement une clé invalide', async () => {
    setFetch((async () => new Response('{"error":{"message":"API key not valid"}}', { status: 400 })) as typeof fetch);
    const task = await createTask({ goal: 'g' });
    const done = await new AgentRunner(task, { model: { provider: 'gemini', model: 'm' } }, { approve: async () => true }).run();
    expect(done.status).toBe('failed');
    expect(done.result).toContain('API key not valid');
  });

  it('s’arrête proprement quand l’utilisateur annule', async () => {
    const ctrl = new AbortController();
    setFetch((async (_u: string, init: any) => {
      ctrl.abort();
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }) as typeof fetch);
    const task = await createTask({ goal: 'g' });
    const done = await new AgentRunner(task, { model: { provider: 'gemini', model: 'm' } }, { approve: async () => true, signal: ctrl.signal }).run();
    expect(done.status).toBe('cancelled');
  });

  it('mode démonstration : plan, recherche réelle, fichier, vérification sans clé', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes('/api/search'))
        return new Response(JSON.stringify({ results: [{ title: 'Meknès', url: 'https://fr.wikipedia.org/wiki/Mekn%C3%A8s', snippet: 'Ville impériale du Maroc' }] }), { status: 200 });
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
    try {
      const task = await createTask({ goal: 'Rédige un rapport sur Meknès' });
      const done = await new AgentRunner(task, { model: { provider: 'demo', model: 'wakil-demo' } }, { approve: async () => true }).run();
      expect(done.status).toBe('done');
      expect(done.steps.map((st) => st.status)).toEqual(['done', 'done']);
      const f = (await listFiles('')).find((x) => x.path === 'demo/rapport.md');
      expect(f?.content).toContain('Meknès');
      expect(f?.content).toContain('mode démonstration');
      expect(done.result).toContain('demo/rapport.md');
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
