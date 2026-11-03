# 06 – Modèles de données

Définis dans `src/core/types.ts`. Chaque enregistrement possède `id`, `createdAt`, `updatedAt` et `deleted` (suppression douce pour la synchro).

| Collection | Champs principaux | Rôle |
|---|---|---|
| **users** (`profile`) | name, email, cloudUserId | Profil local (+ compte cloud optionnel) |
| **projects** | name, description, instructions, color, icon, archived | Contexte permanent |
| **chats** | title, projectId, agentId, mode (`chat`/`agent`), pinned, model | Conversations |
| **messages** | chatId, role (`user`/`assistant`/`tool`), content, toolCalls[], toolName, taskId, providerMeta, attachments[], error | Fil de discussion |
| **tasks** | goal, title, status, steps[], logs[], result, fileIds[], model, iterations, verification | Exécutions autonomes |
| **tasks.steps** | title, detail, status, result, startedAt, endedAt | Plan |
| **logs** (`tasks.logs`) | at, kind (`plan`/`step`/`tool`/`tool_result`/`verify`/`error`/`final`), text, data, stepId | Journal d’exécution |
| **agents** | name, emoji, description, systemPrompt, tools[], model, builtin | Agents spécialisés |
| **tools** | name, description, urlTemplate, params[], enabled | Plugins HTTP |
| **files** | path, projectId, taskId, mime, content, size, binary | Espace de travail |
| **memory** | content, tags[], projectId, source (`user`/`agent`) | Mémoire persistante |
| **settings** | theme, defaultModel, providers{clé, url, modèles}, disabledTools, requireApprovalFor, limites, pinHash, cloud | Réglages (jamais synchronisés) |
| **logs** (application) | at, level, message, context | Erreurs techniques locales |

## Statuts d’une tâche
`queued → planning → running → verifying → (running si corrections) → done` ; ou `failed` / `cancelled`.

## Côté serveur (Supabase)
Table unique `wakil_records(user_id, collection, id, data jsonb, deleted, updated_at)` avec clé primaire `(user_id, collection, id)` et politiques RLS « chacun ses lignes ». Synchro « le plus récent gagne ». Voir `supabase/schema.sql`.
