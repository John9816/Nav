import { supabase } from './supabaseClient';
import { GuestbookMessage } from '../types';

export const fetchMessages = async (): Promise<GuestbookMessage[]> => {
  const { data, error } = await supabase
    .from('guestbook_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50); // Limit to latest 50 for performance

  if (error) throw error;
  return data || [];
};

export const postMessage = async (
  userId: string, 
  content: string, 
  nickname: string | null, 
  avatarUrl: string | null
): Promise<GuestbookMessage> => {
  const { data, error } = await supabase
    .from('guestbook_messages')
    .insert([
      { 
        user_id: userId, 
        content, 
        nickname: nickname || '匿名用户', 
        avatar_url: avatarUrl 
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteMessage = async (id: string) => {
  const { error } = await supabase
    .from('guestbook_messages')
    .delete()
    .eq('id', id);

  if (error) throw error;
};