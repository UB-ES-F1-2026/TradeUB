-- US1.5 (#112): taula privada amb el hash del PIN de seguretat.
--
-- El PIN no va a profiles perquè l'usuari pot llegir tota la seva fila de
-- profiles (el RLS filtra files, no columnes) i GET /api/v1/users/me la
-- retorna sencera. Amb el hash al navegador, un token robat permetria provar
-- els 10.000 PINs de 4 dígits fora de línia.
--
-- pin_hash: mai el PIN en clar. Format "scrypt$n$r$p$sal$hash" (base64), el
--   genera core/pin.py amb hashlib.scrypt.
--
-- RLS actiu i sense cap política: ni anon ni authenticated hi poden llegir
-- ni escriure. Només el backend, amb la clau secreta, hi accedeix. El
-- frontend sap si l'usuari té PIN amb GET /api/v1/profile/pin.
--
-- La migració es pot tornar a executar.

create table if not exists public.profile_pins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.profile_pins enable row level security;

-- Supabase dona permisos per defecte a anon i authenticated sobre les taules
-- noves de public. Sense polítiques el RLS ja ho denega tot; es revoquen
-- igualment com a segona defensa per si algú hi afegeix una política.
revoke all on public.profile_pins from anon, authenticated;
