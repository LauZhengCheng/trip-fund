import { supabase } from './supabase'

export type Trip = {
  id: string
  name: string
  base_currency: string
  created_at: string
}

export async function listMyTrips(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('id, name, base_currency, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createTrip(name: string, userId: string): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .insert({ name, base_currency: 'MYR', created_by: userId })
    .select('id, name, base_currency, created_at')
    .single()
  if (error) throw error
  return data
}
