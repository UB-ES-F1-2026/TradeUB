-- US1.6 (#188): comptador d'intents fallits del PIN i bloqueig de 15 minuts.
--
-- failed_attempts: PINs incorrectes seguits des de l'últim encert o bloqueig.
-- locked_until: fins quan està bloquejat el PIN (null si no ho està).
--
-- Les operacions (require_pin) i el canvi de PIN (POST /api/v1/profile/pin)
-- comparteixen el mateix comptador. La taula ja és privada (RLS sense
-- polítiques, 20261114130000_profile_pins.sql), així que el client no veu
-- aquestes columnes.
--
-- register_pin_attempt fa el comptatge en una sola crida i bloqueja la fila
-- amb "for update": si el backend llegís i escrivís en dues crides, unes
-- quantes peticions en paral·lel podrien provar més de 3 PINs. El backend
-- comprova el hash (scrypt no es pot calcular aquí) i passa el resultat:
-- 1. Si el bloqueig és actiu, no compta res i retorna el temps que falta,
--    encara que el PIN sigui correcte (C4).
-- 2. Si el bloqueig ha caducat, el comptador torna a 0 abans de comptar (C5).
-- 3. PIN correcte: el comptador torna a 0 (C6). Incorrecte: suma 1 i al 3r
--    error bloqueja 15 minuts.
--
-- Retorna {"remaining_attempts": int, "retry_after_seconds": int | null}.
-- retry_after_seconds no és null si el PIN queda o ja estava bloquejat.
--
-- Errors: P0002 si l'usuari no té PIN (el backend ja ho comprova abans).
--
-- Depèn de profile_pins, que referencia public.profiles: supabase/tests/run.sh
-- se la salta, igual que la migració que crea la taula.
--
-- La migració es pot tornar a executar.

alter table public.profile_pins
    add column if not exists failed_attempts int not null default 0,
    add column if not exists locked_until timestamptz;

create or replace function public.register_pin_attempt(
    p_user_id uuid,
    p_success boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_max_attempts constant int := 3;
    v_attempts int;
    v_locked_until timestamptz;
begin
    select failed_attempts, locked_until into v_attempts, v_locked_until
    from public.profile_pins
    where user_id = p_user_id
    for update;

    if not found then
        raise exception 'PIN not configured for user %', p_user_id
            using errcode = 'P0002';
    end if;

    if v_locked_until > now() then
        return jsonb_build_object(
            'remaining_attempts', 0,
            'retry_after_seconds',
            ceil(extract(epoch from v_locked_until - now()))::int
        );
    end if;

    if v_locked_until is not null then
        v_attempts := 0;
        v_locked_until := null;
    end if;

    if p_success then
        v_attempts := 0;
    else
        v_attempts := v_attempts + 1;
        if v_attempts >= v_max_attempts then
            v_locked_until := now() + interval '15 minutes';
        end if;
    end if;

    update public.profile_pins
    set failed_attempts = v_attempts,
        locked_until = v_locked_until
    where user_id = p_user_id;

    return jsonb_build_object(
        'remaining_attempts', greatest(v_max_attempts - v_attempts, 0),
        'retry_after_seconds',
        ceil(extract(epoch from v_locked_until - now()))::int
    );
end;
$$;

-- Només el backend (service_role) pot registrar intents.
revoke all on function public.register_pin_attempt(uuid, boolean) from public, anon, authenticated;
grant execute on function public.register_pin_attempt(uuid, boolean) to service_role;
