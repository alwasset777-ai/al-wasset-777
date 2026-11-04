// Mode démonstration : un « modèle » local scénarisé qui montre le fonctionnement
// de l'agent (plan → recherche → fichier → vérification → livraison) sans clé IA.
// Les outils sont réellement exécutés (recherche Wikipédia, création de fichier).
// Clairement signalé à l'utilisateur ; il ne remplace pas une vraie IA.
import type { LLMRequest, LLMResponse } from './providers';

const id = () => 'demo_' + Math.random().toString(36).slice(2, 10);
const text = (t: string): LLMResponse => ({ text: t, toolCalls: [] });
const call = (name: string, args: Record<string, unknown>): LLMResponse => ({ text: '', toolCalls: [{ id: id(), name, args }] });

function between(s: string, start: string, end?: string) {
  const i = s.indexOf(start);
  if (i < 0) return '';
  const rest = s.slice(i + start.length);
  if (!end) return rest.trim();
  const j = rest.indexOf(end);
  return (j < 0 ? rest : rest.slice(0, j)).trim();
}

function goalOf(req: LLMRequest): string {
  const all = req.messages.map((m) => m.content).join('\n');
  return (between(all, 'OBJECTIF GLOBAL :', '\n') || between(all, 'OBJECTIF :', '\n') || between(all, 'Objectif :', '\n') || req.messages[req.messages.length - 1]?.content || '').slice(0, 200);
}

/** Mots-clés de recherche à partir de l'objectif (retire les verbes d'action courants). */
export function searchQuery(goal: string) {
  return (
    goal
      .replace(/^(rédige|écris|crée|fais|prépare|donne|trouve|cherche|explique|analyse|résume)[-\s]*(moi)?\s*/i, '')
      .replace(/\b(un|une|des|le|la|les|sur|pour|avec|et|en|du|de|d’|l’)\b/gi, ' ')
      .replace(/[.,;:!?«»"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 6)
      .join(' ') || goal
  );
}

export async function demoComplete(req: LLMRequest): Promise<LLMResponse> {
  await new Promise((r) => setTimeout(r, 450));
  if (req.signal?.aborted) throw new DOMException('Arrêté', 'AbortError');
  const sys = req.system || '';
  const first = req.messages[0]?.content || '';
  const last = req.messages[req.messages.length - 1];
  const toolResults = req.messages.filter((m) => m.role === 'tool');
  const goal = goalOf(req);

  if (sys.includes('Tu es le planificateur'))
    return text(
      JSON.stringify({
        title: `Démo : ${goal.slice(0, 60)}`,
        steps: [
          { title: 'Rechercher des informations', detail: 'Recherche web sur le sujet (outil web_search).' },
          { title: 'Rédiger le livrable', detail: 'Créer un rapport Markdown avec les sources (outil write_file).' },
        ],
      }),
    );

  if (sys.includes('contrôleur qualité')) return text(JSON.stringify({ ok: true, notes: 'Le rapport de démonstration a été créé avec ses sources.', fixes: [] }));

  if (first.includes('MAINTENANT : Rechercher')) {
    if (!toolResults.length) return call('web_search', { query: searchQuery(goal) });
    return text(`Informations obtenues :\n${toolResults[toolResults.length - 1].content.slice(0, 2500)}`);
  }

  if (first.includes('MAINTENANT : Rédiger')) {
    if (!toolResults.length) {
      const found = between(first, 'RÉSULTATS DES ÉTAPES PRÉCÉDENTES :', 'ÉTAPE À RÉALISER') || 'Aucune information trouvée.';
      const content = [
        `# ${goal}`,
        '',
        '> Rapport créé en **mode démonstration** : Wakil a réellement cherché sur le web et créé ce fichier, mais sans intelligence artificielle. Ajoutez une clé gratuite (Réglages → Modèles IA) pour des rapports rédigés, analysés et vérifiés.',
        '',
        '## Informations trouvées',
        '',
        found.replace(/^Étape « [^»]+ » :\s*/gm, '').replace(/^Informations obtenues :\s*/m, ''),
        '',
        `_Généré par Wakil le ${new Date().toLocaleDateString('fr-FR')}._`,
      ].join('\n');
      return call('write_file', { path: 'demo/rapport.md', content });
    }
    return text('Fichier demo/rapport.md créé.');
  }

  if ((last?.content || '').includes('Rédige la réponse finale'))
    return text(
      [
        '## Tâche terminée (mode démonstration)',
        '',
        `Objectif : **${goal}**`,
        '',
        '1. Wakil a établi un plan de 2 étapes.',
        '2. Il a cherché sur le web.',
        '3. Il a créé le fichier **demo/rapport.md** (voir Fichiers).',
        '4. Il a vérifié le résultat.',
        '',
        'Pour des réponses vraiment intelligentes (analyse, rédaction, code, sites web…), ajoutez une **clé IA gratuite** : Réglages → Modèles IA → Google Gemini.',
      ].join('\n'),
    );

  // Mode conversation : une recherche réelle puis un résumé simple.
  const question = (last?.role === 'user' ? last.content : req.messages.filter((m) => m.role === 'user').pop()?.content) || '';
  if (req.tools?.some((t) => t.name === 'web_search') && !toolResults.length && question.trim().length > 3)
    return call('web_search', { query: searchQuery(question) });
  return text(
    [
      'Je suis en **mode démonstration** : je peux montrer comment je travaille (recherche, fichiers, plan en mode Agent), mais je ne comprends pas encore vraiment vos demandes.',
      toolResults.length ? `\nVoici ce que j’ai trouvé :\n\n${toolResults[toolResults.length - 1].content.slice(0, 1500)}` : '',
      '\nPour activer la vraie intelligence (gratuit) : **Réglages → Modèles IA → Google Gemini**, collez votre clé obtenue sur aistudio.google.com/apikey.',
    ].join('\n'),
  );
}
