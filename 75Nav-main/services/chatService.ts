import { supabase } from './supabaseClient';
import { ChatMessage } from '../types';

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

// 创建新会话
export const createSession = async (userId: string, title: string) => {
  const { data, error } = await supabase
    .from('sessions')
    .insert([{ user_id: userId, title }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ChatSession;
};

// 获取用户的会话列表
export const getSessions = async (userId: string) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as ChatSession[];
};

// 删除会话
export const deleteSession = async (sessionId: string) => {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw new Error(error.message);
};

// 删除单条消息
export const deleteMessage = async (messageId: string) => {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (error) throw new Error(error.message);
};

// 更新会话时间戳
export const updateSessionTimestamp = async (sessionId: string) => {
  const { error } = await supabase
    .from('sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) console.error("Failed to update session timestamp", error);
};

// 保存消息
export const saveMessage = async (sessionId: string, userId: string, role: 'user' | 'model', content: string) => {
  // DB expects 'model', not 'assistant'. Removing mapping that caused constraint violation.
  const { data, error } = await supabase
    .from('messages')
    .insert([{ 
        session_id: sessionId, 
        user_id: userId, 
        role: role, 
        content 
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  // Implicitly update session timestamp on new message
  await updateSessionTimestamp(sessionId);

  return data;
};

// 获取会话的所有消息
export const getMessages = async (sessionId: string): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((msg: any) => {
    let textContent = '';
    if (typeof msg.content === 'string') {
        textContent = msg.content;
    } else if (msg.content && typeof msg.content === 'object') {
        textContent = JSON.stringify(msg.content);
    } else {
        textContent = String(msg.content || '');
    }

    return {
        id: msg.id,
        // Map 'assistant' back to 'model' just in case, though we are now saving 'model'
        role: (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user',
        text: textContent,
    };
  });
};

// 更新会话标题
export const updateSessionTitle = async (sessionId: string, title: string) => {
    const { error } = await supabase
        .from('sessions')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    if (error) throw new Error(error.message);
};