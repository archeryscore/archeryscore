document.addEventListener("DOMContentLoaded", () => {
    caricaConteggiLuoghi();

    document.querySelectorAll("[data-luoghi-tab]").forEach(btn => {
        btn.addEventListener("click", () => apriLuoghiVisitati(btn.dataset.luoghiTab));
    });
});

async function fetchLuoghiStats(anno="all"){
    const res = await fetch(`/api/mappa/statistiche?anno=${encodeURIComponent(anno)}`);
    return await res.json();
}

async function caricaConteggiLuoghi(){
    try{
        const data = await fetchLuoghiStats("all");

        setLuoghiText("localitaCount", data.localita_count || 0);
        setLuoghiText("provinceCount", data.province_count || 0);
        setLuoghiText("regioniCount", data.regioni_count || 0);
    }catch(err){
        console.error("Luoghi:",err);
    }
}

function setLuoghiText(id,value){
    const el = document.getElementById(id);
    if(el) el.textContent = value;
}

function labelGare(n){
    n = Number(n || 0);
    return n === 1 ? "1 gara" : `${n} gare`;
}

async function apriLuoghiVisitati(tab="localita", anno="all"){
    let modal = document.getElementById("luoghiModal");

    if(!modal){
        modal = document.createElement("div");
        modal.id = "luoghiModal";
        modal.className = "modal hidden";
        modal.innerHTML = `
            <div class="modal-box luoghi-modal-box">
                <div id="luoghiModalContent"></div>
                <div class="modal-actions">
                    <button class="secondary-btn" onclick="chiudiLuoghiVisitati()">Chiudi</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const content = document.getElementById("luoghiModalContent");
    content.innerHTML = `<div class="empty-state">Caricamento luoghi...</div>`;

    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");

    try{
        const data = await fetchLuoghiStats(anno);

        content.innerHTML = `
            <div class="luoghi-header">
                <h2>📍 Luoghi visitati</h2>
                <p>Località, province e regioni dove hai gareggiato.</p>
            </div>

            <div class="luoghi-popup-filter">
                <label>Stagione</label>
                <select id="luoghiYearSelect">
                    <option value="all">Tutte</option>
                    ${(data.anni || []).map(y => `<option value="${y}" ${String(y) === String(anno) ? "selected" : ""}>${y}</option>`).join("")}
                </select>
            </div>

            <div class="luoghi-summary three">
                <div>
                    <span>Località</span>
                    <strong>${data.localita_count || 0}</strong>
                    <button class="mini-view-btn modal-tab ${tab === "localita" ? "active" : ""}" onclick="renderLuoghiTab('localita')">Vedi</button>
                </div>
                <div>
                    <span>Province</span>
                    <strong>${data.province_count || 0}</strong>
                    <button class="mini-view-btn modal-tab ${tab === "province" ? "active" : ""}" onclick="renderLuoghiTab('province')">Vedi</button>
                </div>
                <div>
                    <span>Regioni</span>
                    <strong>${data.regioni_count || 0}</strong>
                    <button class="mini-view-btn modal-tab ${tab === "regioni" ? "active" : ""}" onclick="renderLuoghiTab('regioni')">Vedi</button>
                </div>
            </div>

            <div id="luoghiTabContent"></div>
        `;

        window.__luoghiData = data;
        window.__luoghiTab = tab;

        document.getElementById("luoghiYearSelect")?.addEventListener("change", e => {
            apriLuoghiVisitati(window.__luoghiTab || "localita", e.target.value);
        });

        renderLuoghiTab(tab);

    }catch(err){
        console.error(err);
        content.innerHTML = `<div class="empty-state">Errore caricamento luoghi</div>`;
    }
}

function renderLuoghiTab(tab){
    const data = window.__luoghiData || {};
    window.__luoghiTab = tab;

    const box = document.getElementById("luoghiTabContent");
    if(!box) return;

    document.querySelectorAll(".modal-tab").forEach(btn => btn.classList.remove("active"));
    document.querySelector(`.modal-tab[onclick="renderLuoghiTab('${tab}')"]`)?.classList.add("active");

    const titolo = tab === "localita"
        ? "Località visitate"
        : tab === "province"
            ? "Province visitate"
            : "Regioni visitate";

    const rows = data[tab] || [];

    box.innerHTML = `
        <div class="luoghi-list single">
            <h3>${titolo}</h3>
            ${
                rows.length
                    ? rows.map(r => `<p><strong>${r.nome}</strong><span>${labelGare(r.count)}</span></p>`).join("")
                    : "<p>Nessun dato disponibile</p>"
            }
        </div>
    `;
}

function chiudiLuoghiVisitati(){
    document.getElementById("luoghiModal")?.classList.add("hidden");
    document.body.classList.remove("modal-open");
}
