import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Comprova una contrasenya sense tocar la sessió de l'usuari. Fa servir un client a part que no desa
// la sessió (un inici de sessió normal la substituiria per una d'aal1) i la tanca només en aquest client
export async function verifyPassword(email, password) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'tradeub-password-check',
    },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  await client.auth.signOut({ scope: 'local' })
}
