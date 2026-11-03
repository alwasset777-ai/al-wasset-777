-- Wakil — schéma Supabase (offre gratuite) pour la synchronisation multi-appareils.
-- À coller dans Supabase → SQL Editor → Run.
--
-- Choix : une table générique « wakil_records » (une ligne = un enregistrement
-- local : projet, conversation, message, tâche, agent, outil, fichier, mémoire).
-- Avantages : schéma stable, synchro simple « le plus récent gagne », et la
-- sécurité par ligne (RLS) garantit que chacun ne voit que ses données.
-- Les réglages (qui contiennent les clés API) ne sont jamais synchronisés.

create table if not exists public.wakil_records (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  collection text        not null check (collection in ('profile','projects','chats','messages','tasks','agents','tools','files','memory')),
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create index if not exists wakil_records_user_updated on public.wakil_records (user_id, updated_at);

alter table public.wakil_records enable row level security;

drop policy if exists "wakil: lire ses données" on public.wakil_records;
create policy "wakil: lire ses données" on public.wakil_records
  for select using (auth.uid() = user_id);

drop policy if exists "wakil: créer ses données" on public.wakil_records;
create policy "wakil: créer ses données" on public.wakil_records
  for insert with check (auth.uid() = user_id);

drop policy if exists "wakil: modifier ses données" on public.wakil_records;
create policy "wakil: modifier ses données" on public.wakil_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "wakil: supprimer ses données" on public.wakil_records;
create policy "wakil: supprimer ses données" on public.wakil_records
  for delete using (auth.uid() = user_id);

-- Vues pratiques (lecture) qui exposent les modèles de données « à plat ».
create or replace view public.wakil_projects with (security_invoker = on) as
  select id, data->>'name' as name, data->>'description' as description, updated_at
  from public.wakil_records where collection = 'projects' and not deleted;

create or replace view public.wakil_tasks with (security_invoker = on) as
  select id, data->>'title' as title, data->>'status' as status, data->>'goal' as goal, updated_at
  from public.wakil_records where collection = 'tasks' and not deleted;
