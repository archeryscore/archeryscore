if(typeof filterBySelectedYear === 'undefined'){window.filterBySelectedYear = items => items || []; window.ensureYearFilter = () => {};}
if(typeof caricaConfronto === 'undefined'){window.caricaConfronto = async () => null; window.renderConfrontoPersonale = () => '';}
const recordList = document.getElementById("recordList");
const searchInput = document.getElementById("searchInput");
let allenamenti = [];

carica();

searchInput?.addEventListener("input", render);

async function carica(){
    const res = await fetch("/api/allenamenti");
    allenamenti = await res.json();
    ensureYearFilter(allenamenti, render);
    render();
}

function chiave(a){
    return `${a.tipo_allenamento}|${a.tipo_arco}|${a.distanza || ""}|${a.piazzole || ""}`;
}

function render(){
    const q = (searchInput?.value || "").toLowerCase();
    const gruppi = {};

    filterBySelectedYear(allenamenti).forEach(a => {
        const k = chiave(a);
        if(!gruppi[k]) gruppi[k] = [];
        gruppi[k].push(a);
    });

    const cards = Object.values(gruppi).map(items => {
        items.sort((a,b) => (b.punteggio || 0) - (a.punteggio || 0));

        const best = items[0];
        const worst = [...items].sort((a,b) => (a.punteggio || 0) - (b.punteggio || 0))[0];
        const media = items.reduce((s,a) => s + (a.punteggio || 0),0) / items.length;
        const text = `${best.tipo_allenamento} ${best.tipo_arco} ${best.distanza || ""} ${best.piazzole || ""}`.toLowerCase();

        if(q && !text.includes(q)) return "";

        return `
            <div class="record-card">
                <div class="record-header">
                    <div>
                        <h2>${titoloAllenamento(best)}</h2>
                        <p>${best.tipo_arco} · ${items.length} ${items.length === 1 ? "allenamento" : "allenamenti"}</p>
                    </div>
                    <div class="record-badge">${best.tipo_allenamento}</div>
                </div>

                <div class="record-grid">
                    <div class="record-box best-record">
                        <span>Miglior punteggio</span>
                        <strong>${best.punteggio || 0}</strong>
                        <small>${formatDate(best.data)}</small>
                        <button class="record-view-btn" onclick="apriScoreAllenamento(${best.id})">Vedi</button>
                    </div>

                    <div class="record-box">
                        <span>${labelsAllenamento(best)[0]} nel migliore</span>
                        <strong>${specialA(best)}</strong>
                    </div>

                    <div class="record-box">
                        <span>${labelsAllenamento(best)[1]} nel migliore</span>
                        <strong>${specialB(best)}</strong>
                    </div>

                    <div class="record-box worst-record">
                        <span>Peggior punteggio</span>
                        <strong>${worst.punteggio || 0}</strong>
                        <small>${formatDate(worst.data)}</small>
                        <button class="record-view-btn" onclick="apriScoreAllenamento(${worst.id})">Vedi</button>
                    </div>

                    <div class="record-box">
                        <span>Media</span>
                        <strong>${media.toFixed(1)}</strong>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    recordList.innerHTML = cards || `<div class="empty-archive">Nessun record disponibile</div>`;
}
