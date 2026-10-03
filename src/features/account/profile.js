import { msg } from "../../shared/i18n/index.js?v=16.8.0.7";
import { escapeHtml } from "../../shared/ui/html.js?v=16.8.0.7";
import { panel } from "../../shared/ui/panel.js?v=16.8.0.7";
import { filterNickname } from "../../../packages/alantil-core/profile.js?v=16.8.0.7";

function renderAccountFact(label, value) {
  return `<div class="accountFact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`;
}
function genderLabel(gender){return gender==="female"?msg("account.zhenskiy_2"):gender==="male"?msg("account.muzhskoy_2"):"—";}
function genderPicker(gender=""){
  return `<fieldset class="accountGenderField"><legend>${msg("account.pol_avatara")}</legend><div class="segmentControl settingsSegments accountGenderOptions" role="radiogroup"><label class="settingsChoice accountGenderOption"><input type="radio" name="avatarGender" value="male" ${gender==="male"?"checked":""}/><span class="settingsChoiceBody">${msg("account.muzhskoy_2")}</span></label><label class="settingsChoice accountGenderOption"><input type="radio" name="avatarGender" value="female" ${gender==="female"?"checked":""}/><span class="settingsChoiceBody">${msg("account.zhenskiy_2")}</span></label></div><p class="accountPrivacyNote">${msg("profile.vybor_vypolnyaetsya_odin_raz_i_pozzhe_ne")}</p></fieldset>`;
}

export function renderProfileCreation(context, user, {
  nickname = "",
  gender = "",
  nicknameMessage = "",
  nicknameState = "",
  error = "",
  unavailable = false,
  submitEnabled = false,
  title = "",
} = {}) {
  const nicknameClass = nicknameState === "available" ? " isSuccess" : nicknameState === "invalid" ? " isError" : "";
  const heading=title||(!nickname?msg("account.sozdayte_nikneym"):msg("account.vyberite_pol_avatara"));
  context.shell.setHeaderContent?.({ title: heading });
  context.root.innerHTML = panel({
    title: heading,
    classes: "accountPanel",
    viewClasses: "accountView",
    body: `<div class="accountStack">
        ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
        <form id="accountProfileForm" class="accountForm" novalidate>
          <label class="accountField" for="accountProfileEmail"><span>Email</span><input id="accountProfileEmail" type="email" value="${escapeHtml(user?.email || "")}" readonly /></label>
          <label class="accountField" for="accountNickname"><span>${msg("account.nikneym")}</span><input id="accountNickname" class="${nicknameClass.trim()}" name="nickname" type="text" minlength="3" maxlength="15" pattern="[A-Za-z0-9_]{3,15}" inputmode="text" autocomplete="nickname" autocapitalize="none" lang="en" spellcheck="false" value="${escapeHtml(nickname)}" ${unavailable ? "disabled" : ""} aria-invalid="${nicknameState === "invalid" ? "true" : "false"}" required /></label>
          <div id="accountNicknameMessage" class="accountNicknameMessage ${escapeHtml(nicknameState)}" role="status">${escapeHtml(nicknameMessage)}</div>
          ${genderPicker(gender)}
          <button id="accountCreateProfile" class="btn actionPrimary accountAction" type="submit" ${submitEnabled && !unavailable ? "" : "disabled"}>${msg("account.sohranit")}</button>
        </form>
        ${unavailable ? `<button id="accountRetryProfile" class="btn actionPrimary accountAction" type="button">${msg("account.povtorit")}</button>` : ""}
        <button id="accountSignOut" class="btn actionText accountAction" type="button">${msg("account.vyyti")}</button>
      </div>`,
  });
}

export function bindProfileCreation(context, signal, { onNicknameInput,onGenderChange,onSubmit,onRetry,onSignOut } = {}) {
  const form = context.root.querySelector("#accountProfileForm"),nicknameInput=context.root.querySelector("#accountNickname"),retryButton=context.root.querySelector("#accountRetryProfile"),signOutButton=context.root.querySelector("#accountSignOut");
  nicknameInput?.addEventListener("input",()=>{const filteredValue=filterNickname(nicknameInput.value);if(nicknameInput.value!==filteredValue)nicknameInput.value=filteredValue;onNicknameInput?.(filteredValue,{inputElement:nicknameInput,messageElement:context.root.querySelector("#accountNicknameMessage"),submitButton:context.root.querySelector("#accountCreateProfile")});},{signal});
  context.root.querySelectorAll('input[name="avatarGender"]').forEach((input)=>input.addEventListener("change",()=>{if(input.checked)onGenderChange?.(input.value,{submitButton:context.root.querySelector("#accountCreateProfile")});},{signal}));
  form?.addEventListener("submit",async(event)=>{event.preventDefault();if(nicknameInput?.disabled)return;const submitButton=context.root.querySelector("#accountCreateProfile");if(submitButton)submitButton.disabled=true;const gender=context.root.querySelector('input[name="avatarGender"]:checked')?.value||"";await onSubmit?.({nickname:nicknameInput?.value||"",gender});},{signal});
  retryButton?.addEventListener("click",async()=>{retryButton.disabled=true;retryButton.textContent=msg("account.proveryaem");await onRetry?.();},{signal});
  signOutButton?.addEventListener("click",async()=>{signOutButton.disabled=true;try{await onSignOut?.();}finally{if(signOutButton.isConnected)signOutButton.disabled=false;}},{signal});
}

export function renderProfile(context,{user,profile,provider,error="",nickname="",nicknameMessage="",nicknameState="",submitEnabled=false}){
  const nicknameClass=nicknameState==="available"?" isSuccess":nicknameState==="invalid"?" isError":"";
  context.shell.setHeaderContent?.({title:msg("account.akkaunt")});
  context.root.innerHTML=panel({title:msg("account.akkaunt"),classes:"accountPanel",viewClasses:"accountView",body:`<div class="accountStack">
    ${error?`<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>`:""}
    <form id="accountNicknameUpdateForm" class="accountForm" novalidate>
      <label class="accountField" for="accountNicknameEdit"><span>${msg("account.nikneym")}</span><input id="accountNicknameEdit" class="${nicknameClass.trim()}" type="text" minlength="3" maxlength="15" value="${escapeHtml(nickname||profile?.nickname||"")}" autocomplete="nickname" autocapitalize="none" spellcheck="false"/></label>
      <div id="accountNicknameMessage" class="accountNicknameMessage ${escapeHtml(nicknameState)}" role="status">${escapeHtml(nicknameMessage)}</div>
      <button id="accountSaveNickname" class="btn actionPrimary accountAction" type="submit" ${submitEnabled?"":"disabled"}>${msg("account.sohranit")}</button>
    </form>
    <dl class="accountFacts">${renderAccountFact("Email",user?.email||"")}${renderAccountFact(msg("account.sposob_vhoda"),provider)}${renderAccountFact(msg("account.pol_avatara"),genderLabel(profile?.avatar_gender))}</dl>
    <button id="accountSignOut" class="btn actionText accountAction" type="button">${msg("account.vyyti")}</button>
  </div>`});
}
export function bindProfile(context,signal,{onNicknameInput,onNicknameSubmit,onSignOut}={}){
  const input=context.root.querySelector("#accountNicknameEdit"),form=context.root.querySelector("#accountNicknameUpdateForm"),signOutButton=context.root.querySelector("#accountSignOut");
  input?.addEventListener("input",()=>{const filtered=filterNickname(input.value);if(input.value!==filtered)input.value=filtered;onNicknameInput?.(filtered,{inputElement:input,messageElement:context.root.querySelector("#accountNicknameMessage"),submitButton:context.root.querySelector("#accountSaveNickname")});},{signal});
  form?.addEventListener("submit",async(event)=>{event.preventDefault();const button=context.root.querySelector("#accountSaveNickname");if(button)button.disabled=true;await onNicknameSubmit?.(input?.value||"");},{signal});
  signOutButton?.addEventListener("click",async()=>{signOutButton.disabled=true;try{await onSignOut?.();}finally{if(signOutButton.isConnected)signOutButton.disabled=false;}},{signal});
}
