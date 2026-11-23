import { describe, it, expect, vi, beforeEach } from 'vitest'

// Cada createClient retorna un client fals; el primer és el client principal de l'app
const clients = vi.hoisted(() => [])
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url, key, options) => {
    const client = {
      options,
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    }
    clients.push(client)
    return client
  }),
}))

import { createClient } from '@supabase/supabase-js'
import { supabase, verifyPassword } from '../services/supabase'

const lastClient = () => clients[clients.length - 1]

describe('verifyPassword', () => {
  beforeEach(() => {
    clients.splice(1)
  })

  it('comprova la contrasenya amb un client a part que no desa la sessió', async () => {
    await verifyPassword('nom@exemple.com', 'actual123')

    const client = lastClient()
    expect(client).not.toBe(supabase)
    expect(client.options.auth).toMatchObject({ persistSession: false, autoRefreshToken: false })
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'nom@exemple.com', password: 'actual123' })
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('tanca només la sessió temporal, no les altres de l\'usuari', async () => {
    await verifyPassword('nom@exemple.com', 'actual123')

    expect(lastClient().auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it('llança l\'error si la contrasenya és incorrecta', async () => {
    const wrong = Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' })
    createClient.mockImplementationOnce(() => {
      const client = {
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: wrong }),
          signOut: vi.fn(),
        },
      }
      clients.push(client)
      return client
    })

    await expect(verifyPassword('nom@exemple.com', 'dolenta1')).rejects.toBe(wrong)
    expect(lastClient().auth.signOut).not.toHaveBeenCalled()
  })
})
