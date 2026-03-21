import { supabase } from './supabaseClient';
import { Spark } from '../types';

export const saveSpark = async (userId: string, type: 'text' | 'image', content: string) => {
  const { data, error } = await supabase
    .from('sparks')
    .insert([
      { user_id: userId, type, content }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const fetchSparks = async (userId: string): Promise<Spark[]> => {
  const { data, error } = await supabase
    .from('sparks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const deleteSpark = async (sparkId: string) => {
  const { error } = await supabase
    .from('sparks')
    .delete()
    .eq('id', sparkId);

  if (error) throw error;
};

export const updateSpark = async (sparkId: string, content: string): Promise<Spark> => {
  const { data, error } = await supabase
    .from('sparks')
    .update({ content })
    .eq('id', sparkId)
    .select()
    .single();

  if (error) throw error;
  return data;
};
