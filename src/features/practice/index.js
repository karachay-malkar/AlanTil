import { msg } from "../../shared/i18n/index.js?v=16.8.0.3";
import { panel } from "../../shared/ui/panel.js?v=16.8.0.3";
import { uiIcon } from "../../shared/ui/icons.js?v=16.8.0.3";
import { hasActivityAccess } from "../../shared/admin/admin-access.js?v=16.8.0.3";

let controller=null;

export function mount(context){
  controller=new AbortController();
  context.shell.setHeaderContent?.({title:"Alan Til!"});
  context.root.innerHTML=panel({
    title:msg("practice.praktika"),
    classes:"practicePanel",
    viewClasses:"practiceView",
    body:`
      <div class="practiceMenu">
        <button class="menuItem" type="button" data-practice-route="test.menu"><span class="menuIcon">${uiIcon("listChecks")}</span><span class="menuItemText"><strong>${msg("practice.test")}</strong><small>${msg("practice.proverka_slov_iz_vybrannyh_razdelov")}</small></span></button>
        <button class="menuItem" type="button" data-practice-route="match.menu"><span class="menuIcon">${uiIcon("puzzle")}</span><span class="menuItemText"><strong>${msg("practice.sopostavlenie")}</strong><small>${msg("practice.soedinenie_slov_i_perevodov")}</small></span></button>
        <button class="menuItem" type="button" data-practice-route="learn.set" data-dictionary-slug="favorites"><span class="menuIcon">${uiIcon("favorite")}</span><span class="menuItemText"><strong>${msg("common.izbrannoe")}</strong><small>${msg("learn.uchit_slova")}</small></span></button>
        <button class="menuItem" type="button" data-practice-route="songs.playlists"><span class="menuIcon">${uiIcon("music2")}</span><span class="menuItemText"><strong>${msg("practice.pesni")}</strong><small>${msg("practice.yazyk_v_zhivom_kontekste")}</small></span></button>
        <button class="menuItem menuItemSingle" type="button" data-practice-route="practice.ashyk"><span class="menuIcon">${uiIcon("puzzle")}</span><span class="menuItemText"><strong>${msg("practice.ashyk")}</strong></span></button>
        <button class="menuItem" type="button" data-practice-route="practice.tower"><span class="menuIcon">⌂</span><span class="menuItemText"><strong>Къала · Башня</strong><small>Строй за освоенные слова</small></span></button>
        <button class="menuItem" type="button" data-practice-route="practice.masonry" data-masonry-admin style="display:${hasActivityAccess()?"grid":"none"}"><span class="menuIcon">▦</span><span class="menuItemText"><strong>Редактор кладки</strong><small>Ручная сборка секций · Common 100</small></span></button>
      </div>`,
  });
  const adminEntry=context.root.querySelector("[data-masonry-admin]");
  window.addEventListener("alantil:activity-access",(event)=>{if(adminEntry)adminEntry.style.display=event.detail?.enabled?"grid":"none";},{signal:controller.signal});
  context.root.querySelectorAll("[data-practice-route]").forEach((button)=>{
    button.addEventListener("click",()=>{
      const params=button.dataset.dictionarySlug?{dictionarySlug:button.dataset.dictionarySlug}:{};
      context.router.navigate(button.dataset.practiceRoute,params);
    },{signal:controller.signal});
  });
}

export function unmount(){controller?.abort();controller=null;}
