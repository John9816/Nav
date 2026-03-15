import { supabase } from './supabaseClient';

export interface AppVersion {
  version: string;
  build_number: number;
  download_url: string | null;
  description: string | null;
  force_update: boolean | null;
  min_build_number: number | null;
  created_at: string | null;
}

/**
 * Fetch the first row from public.app_version.
 * Note: This follows the user's requirement "取第一条数据".
 * If you later want "latest", switch to order by build_number/created_at desc.
 */
export const fetchFirstAppVersion = async (): Promise<AppVersion | null> => {
  try {
    const { data, error } = await supabase
      .from('app_version')
      .select('version, build_number, download_url, description, force_update, min_build_number, created_at')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data as any) || null;
  } catch (e) {
    console.warn('Fetch app version failed', e);
    return null;
  }
};
