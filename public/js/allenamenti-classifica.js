if(typeof filterBySelectedYear === 'undefined'){window.filterBySelectedYear = items => items || []; window.ensureYearFilter = () => {};}
if(typeof caricaConfronto === 'undefined'){window.caricaConfronto = async () => null; window.renderConfrontoPersonale = () => '';}
const list = document.getElementById("classificaList");

carica();

async function carica(){
    const res = await fetch("/api/allenamenti");
    const allenamenti = await res.json();
    ensureYearFilter(allenamenti, carica);

    const gruppi = {};

    filterBySelectedYear(allenamenti).forEach(a => {
        const key = `${a.tipo_allenamento}|${a.tipo_arco}|${a.distanza || ""}|${a.piazzole || ""}`;
        if(!gruppi[key]) gruppi[key] = [];
        gruppi[key].push(a);
    });

    const html = Object.values(gruppi).map(items => {
        items.sort((a,b) => (b.punteggio || 0) - (a.punteggio || 0));

        const top = items.slice(0,5);
        const first = top[0];

        return `
            <div class="record-card">
                <div class="record-header">
                    <div>
                        <h2>${titoloAllenamento(first)}</h2>
                        <p>${first.tipo_arco} · Top ${top.length} per questo tipo</p>
                    </div>
                    <div class="record-badge">${first.tipo_allenamento}</div>
                </div>

                <div class="top-list">
                    ${top.map((a,i) => `
                        <div class="top-row">
                            <div class="top-position">${i+1}</div>
                            <div class="top-info">
                                <strong>${formatDate(a.data)}</strong>
                                <span>${a.tipo_arco}${a.distanza ? " · " + a.distanza + "m" : ""}${a.piazzole ? " · " + a.piazzole + " piazzole" : ""}</span>
                            </div>
                            <div class="top-score">${a.punteggio || 0}</div>
                            <button class="record-view-btn" onclick="apriScoreAllenamento(${a.id})">Vedi</button>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }).join("");

    list.innerHTML = html || `<div class="empty-archive">Nessun allenamento disponibile</div>`;
}
