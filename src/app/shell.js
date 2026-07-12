export function createShell() {
  const root = document.getElementById("appRoot");
  const backButton = document.getElementById("btnBackArrow");
  const counter = document.getElementById("counter");
  const mode = document.getElementById("mode");
  const modalRoot = document.getElementById("modalRoot");

  if (!root || !backButton || !counter || !mode || !modalRoot) {
    throw new Error("Application shell is incomplete");
  }

  function renderHome() {
    root.innerHTML = `
      <section id="viewDicts" class="view screen homeView">
        <div class="panel homePanel" data-unified-panel="1">
          <div class="panel-header">
            <div class="panelTitle">Алан тил</div>
          </div>
          <div class="panel-body homePanelBody">
            <div class="homeContent">
              <div class="homeMainActions">
                <div class="row"><button class="btn primary" type="button" data-route="test.menu">🧠 Проверь свой уровень!</button></div>
                <div class="row"><button class="btn primary" type="button" data-route="match.menu">🔗 Сопоставь слова</button></div>
                <div class="row"><button class="btn primary" type="button" data-route="learn.catalog">📚 Учить слова</button></div>
                <div class="row"><button class="btn primary" type="button" data-route="songs.playlists">🎵 Песни</button></div>
              </div>
            </div>
            <div class="instagramBlock">
              <a class="instagramLink" href="https://www.instagram.com/alan_til_app?igsh=MTcxanlxb2Z1MHo4cA==" target="_blank" rel="noopener noreferrer" aria-label="Следите за нами в Instagram">
                <span class="instagramBadge" aria-hidden="true">Instagram</span>
                <span class="instagramText">
                  <span class="instagramTitle">Следите за нами в Instagram</span>
                  <span class="instagramSubtitle">Новости проекта и обновления</span>
                </span>
                <span class="instagramArrow" aria-hidden="true">›</span>
              </a>
            </div>
          </div>
        </div>
      </section>`;
  }

  function setBackVisible(visible) {
    backButton.classList.toggle("hidden", !visible);
  }

  function setCounter(text = "") {
    counter.textContent = text;
    counter.style.display = text ? "" : "none";
  }

  function clearMode() {
    mode.textContent = "";
    mode.style.display = "none";
  }

  return { root, backButton, modalRoot, renderHome, setBackVisible, setCounter, clearMode };
}
