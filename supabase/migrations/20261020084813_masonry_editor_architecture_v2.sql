-- Accept editable architectural assemblies without invalidating existing Common 100 recipes.
-- Deployed to AlanTil Supabase as migration 20261020084813.
alter table public.masonry_editor_sections
 drop constraint if exists masonry_editor_sections_check;

alter table public.masonry_editor_sections
 add constraint masonry_editor_sections_check check (
  recipe->>'version' in ('common100-manual-1','common100-mixed-2')
  and recipe->>'cellMeters'='0.25'
  and jsonb_typeof(recipe->'stones')='array'
  and jsonb_array_length(recipe->'stones')<=1500
  and jsonb_typeof(recipe->'cells')='array'
  and jsonb_array_length(recipe->'cells')=3
  and recipe->'cells'=to_jsonb(cells)
  and case
   when recipe->>'version'='common100-manual-1'
    then not (recipe ? 'architectures') or recipe->'architectures'='[]'::jsonb
   when recipe->>'version'='common100-mixed-2'
    then jsonb_typeof(recipe->'architectures')='array'
         and jsonb_array_length(recipe->'architectures')<=40
   else false
  end
 );
