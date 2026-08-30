import { supabase } from '@/src/lib/supabase';

export type MobileWord = {
  word_id: string;
  global_order: number | null;
  story_id: string | null;
  dictionary_id: string | null;
  section_id: string | null;
  set_id: string | null;
  pos: string | null;
  word_alan_cyrillic: string | null;
  word_alan_turkic: string | null;
  translation_ru: string | null;
};

export async function loadStarterWords(limit = 30): Promise<MobileWord[]> {
  const { data, error } = await supabase
    .from('v_words_app')
    .select('word_id,global_order,story_id,dictionary_id,section_id,set_id,pos,word_alan_cyrillic,word_alan_turkic,translation_ru')
    .order('global_order', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as MobileWord[];
}
