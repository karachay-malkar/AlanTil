import "./guide.js?v=16.7.0.17";
import { setInterfaceLanguage } from "../../shared/i18n/index.js?v=13.10.7";
import {
  completeLearningSetup,
  hasCompletedLearningSetup,
} from "../../shared/settings/user-settings-store.js?v=13.10.8";
import {
  bindLearningSetup,
  emptyLearningSetupDraft,
  isLearningSetupDraftComplete,
  renderLearningSetup,
  syncLearningSetupView,
} from "../../shared/settings/learning-setup.js?v=16.7.0.33";
import { setupText } from "../../shared/settings/learning-preview-data.js?v=16.7.0.33";

export async function runLearningSetup({ shell } = {}) {
  if (hasCompletedLearningSetup()) return false;

  const controller = new AbortController();
  const draft = emptyLearningSetupDraft();
  let error = "";

  shell.appShell.dataset.feature = "onboarding";
  shell.appShell.dataset.screen = "home";
  shell.appShell.dataset.layout = "document";
  shell.appShell.dataset.header = "hidden";
  shell.appShell.dataset.bottomNav = "false";
  shell.bottomNav.hidden = true;
  shell.setBackVisible(false);
  shell.setHeaderContent({ title: "" });
  shell.setHeaderAction("");
  shell.setCounter("");
  shell.clearMode();

  shell.root.innerHTML = renderLearningSetup(draft, { error });
  syncLearningSetupView(shell.root, draft, { error, animatePreview: false });

  return new Promise((resolve) => {
    bindLearningSetup(shell.root, controller.signal, {
      onChange(updates) {
        Object.assign(draft, updates);
        if (updates.interface_language_code) {
          setInterfaceLanguage(updates.interface_language_code);
        }
        error = "";
        syncLearningSetupView(shell.root, draft, { error, animatePreview: true });
      },
      onContinue() {
        if (!isLearningSetupDraftComplete(draft)) return;
        try {
          completeLearningSetup({
            ...draft,
            alan_dialect_code: draft.alan_script_code === "turkic"
              ? (draft.alan_dialect_code || "canonical")
              : draft.alan_dialect_code,
          });
          controller.abort();
          resolve(true);
        } catch {
          error = setupText(draft.interface_language_code).storageError;
          syncLearningSetupView(shell.root, draft, { error, animatePreview: false });
        }
      },
    });
  });
}
