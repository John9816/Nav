import { createClient } from '@supabase/supabase-js';

// ==========================================
// SUPABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://vtvzpdupygvtytunrpdw.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_DWdy6_bOXKnHO5aKG7cM0A__mo-PjT8';

// 创建客户端实例
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
