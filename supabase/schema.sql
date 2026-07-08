-- ============================================================================
--  Chemin Vert — Schéma Supabase pour les signatures de la charte
-- ----------------------------------------------------------------------------
--  À exécuter UNE FOIS dans votre projet Supabase :
--    Dashboard → SQL Editor → New query → coller ce fichier → Run.
--
--  Ce schéma garantit que :
--    • n'importe quel visiteur peut SIGNER (insérer son e-mail) ;
--    • PERSONNE ne peut lire la liste des e-mails via l'API publique ;
--    • le compteur public est lisible via une fonction dédiée.
-- ============================================================================

-- 1) Table des signatures
create table if not exists public.signatures (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  lang       text,
  created_at timestamptz not null default now()
);

-- 2) Sécurité au niveau des lignes (RLS)
alter table public.signatures enable row level security;

-- 2a) Autoriser l'INSERTION anonyme (signer la charte)
drop policy if exists "anon_can_sign" on public.signatures;
create policy "anon_can_sign"
  on public.signatures
  for insert
  to anon, authenticated
  with check (true);

-- 2b) AUCUNE policy de lecture (SELECT) n'est créée : la liste des e-mails
--     reste donc inaccessible depuis la clé publique. 👍

-- 3) Compteur public via une fonction SECURITY DEFINER
--    (elle seule peut compter les lignes, sans exposer leur contenu)
create or replace function public.signatures_count()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint from public.signatures;
$$;

grant execute on function public.signatures_count() to anon, authenticated;

-- ============================================================================
--  C'est tout ! Récupérez ensuite dans Project Settings → API :
--    • Project URL      → SUPABASE_URL      (dans config.js)
--    • Project API key « anon public » → SUPABASE_ANON_KEY (dans config.js)
-- ============================================================================
