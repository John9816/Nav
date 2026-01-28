import { supabase } from './supabaseClient';
import { Category, LinkItem } from '../types';
import { getIconByName, getDefaultIconName } from '../utils/iconMap';
import { DEFAULT_CATEGORIES } from '../constants';

// --- Fetch ---

export const fetchUserBookmarks = async (userId: string): Promise<Category[] | null> => {
  try {
    // 1. Fetch Categories
    const { data: categoriesData, error: catError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    if (catError) throw catError;
    // Return empty array if no categories found, so UI shows empty state instead of defaults
    if (!categoriesData || categoriesData.length === 0) return [];

    // 2. Fetch All Links for this user
    const { data: linksData, error: linkError } = await supabase
      .from('links')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    if (linkError) throw linkError;

    // 3. Reconstruct Structure
    const result: Category[] = categoriesData.map((cat: any) => {
      const catLinks = linksData
        ?.filter((l: any) => l.category_id === cat.id)
        .map((l: any) => ({
          id: l.id,
          title: l.title,
          url: l.url,
          description: l.description,
          icon: getIconByName(l.icon_name, getColorClass(l.icon_name)),
          raw_icon_name: l.icon_name
        })) || [];

      return {
        id: cat.id,
        title: cat.title,
        icon: getIconByName(cat.icon_name),
        raw_icon_name: cat.icon_name,
        links: catLinks
      };
    });

    return result;
  } catch (error) {
    console.error('Fetch bookmarks failed:', error);
    return null;
  }
};

// --- CRUD: Categories ---

export const addCategory = async (userId: string, title: string, iconName: string) => {
  // Get max sort order
  const { data: maxOrderData } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();
  
  const nextOrder = (maxOrderData?.sort_order || 0) + 10;

  const { error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      title,
      icon_name: iconName,
      sort_order: nextOrder
    });
  
  if (error) throw error;
};

export const updateCategory = async (categoryId: string, title: string, iconName: string) => {
  const { error } = await supabase
    .from('categories')
    .update({ title, icon_name: iconName })
    .eq('id', categoryId);
  
  if (error) throw error;
};

export const deleteCategory = async (categoryId: string) => {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId);
  
  if (error) throw error;
};

// --- CRUD: Links ---

export const addLink = async (userId: string, categoryId: string, linkData: { title: string, url: string, description: string, iconName: string }) => {
  // Get max sort order in this category
  const { data: maxOrderData } = await supabase
    .from('links')
    .select('sort_order')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxOrderData?.sort_order || 0) + 10;

  const { error } = await supabase
    .from('links')
    .insert({
      user_id: userId,
      category_id: categoryId,
      title: linkData.title,
      url: linkData.url,
      description: linkData.description,
      icon_name: linkData.iconName,
      sort_order: nextOrder
    });

  if (error) throw error;
};

export const updateLink = async (linkId: string, linkData: { title: string, url: string, description: string, iconName: string }) => {
  const { error } = await supabase
    .from('links')
    .update({
      title: linkData.title,
      url: linkData.url,
      description: linkData.description,
      icon_name: linkData.iconName
    })
    .eq('id', linkId);
  
  if (error) throw error;
};

export const deleteLink = async (linkId: string) => {
  const { error } = await supabase
    .from('links')
    .delete()
    .eq('id', linkId);

  if (error) throw error;
};

// --- Import Logic ---

export interface ImportData {
  title: string;
  links: { title: string; url: string }[];
}

export const bulkCreateBookmarks = async (userId: string, data: ImportData[]) => {
  try {
    // Get current max sort order for categories
    const { data: maxOrderData } = await supabase
      .from('categories')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();
    
    let currentCatSort = (maxOrderData?.sort_order || 0);

    for (const catData of data) {
      if (catData.links.length === 0) continue;

      currentCatSort += 10;
      
      // Create Category
      const { data: newCat, error: catError } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          title: catData.title,
          icon_name: 'Globe', // Default icon for imports
          sort_order: currentCatSort
        })
        .select()
        .single();

      if (catError) throw catError;
      if (!newCat) continue;

      // Prepare Links
      const linksPayload = catData.links.map((link, index) => ({
        user_id: userId,
        category_id: newCat.id,
        title: link.title,
        url: link.url,
        description: '',
        icon_name: 'Globe',
        sort_order: (index + 1) * 10
      }));

      // Bulk Insert Links
      const { error: linksError } = await supabase
        .from('links')
        .insert(linksPayload);

      if (linksError) throw linksError;
    }
    
    return { success: true };
  } catch (error) {
    console.error("Bulk import failed", error);
    return { success: false, error };
  }
};

// --- Reset & Clear ---

export const clearUserBookmarks = async (userId: string) => {
  // Delete links first
  const { error: linkError } = await supabase
    .from('links')
    .delete()
    .eq('user_id', userId);
  if (linkError) throw linkError;

  // Delete categories
  const { error: catError } = await supabase
    .from('categories')
    .delete()
    .eq('user_id', userId);
  if (catError) throw catError;
};

export const restoreDefaultBookmarks = async (userId: string) => {
    // 1. Clear existing
    await clearUserBookmarks(userId);

    // 2. Insert Categories and Links based on DEFAULT_CATEGORIES
    let catOrder = 0;
    for (const cat of DEFAULT_CATEGORIES) {
        catOrder += 10;
        // Use mapping to get appropriate icon name string from ID or default
        const catIcon = getDefaultIconName(cat.id, true);
        
        const { data: newCat, error: catError } = await supabase
            .from('categories')
            .insert({
                user_id: userId,
                title: cat.title,
                icon_name: catIcon,
                sort_order: catOrder
            })
            .select()
            .single();
            
        if (catError) throw catError;
        if (!newCat) continue;

        const linksPayload = cat.links.map((link, idx) => ({
            user_id: userId,
            category_id: newCat.id,
            title: link.title,
            url: link.url,
            description: link.description || '',
            icon_name: getDefaultIconName(link.id),
            sort_order: (idx + 1) * 10
        }));

        if (linksPayload.length > 0) {
            const { error: linksError } = await supabase
                .from('links')
                .insert(linksPayload);
            if (linksError) throw linksError;
        }
    }
};


// Helper to add some color to icons based on legacy hardcoded colors
export const getColorClass = (iconName: string | null) => {
  switch (iconName) {
    case 'Book': return "text-blue-500";
    case 'Code': return "text-orange-500";
    case 'Server': return "text-blue-400";
    case 'Sparkles': return "text-purple-500";
    case 'Bot': return "text-emerald-500";
    case 'FileJson': return "text-yellow-500";
    case 'Table': return "text-green-500";
    case 'Scissors': return "text-red-400";
    case 'Network': return "text-cyan-400";
    case 'Mail': return "text-indigo-400";
    case 'Plane': return "text-sky-500";
    case 'Globe': return "text-pink-400";
    case 'Film': return "text-rose-500";
    case 'PlayCircle': return "text-orange-500";
    case 'MessageSquare': return "text-emerald-500";
    case 'Cpu': return "text-blue-500";
    case 'Compass': return "text-indigo-500";
    default: return "text-slate-500";
  }
};