if(typeof filterBySelectedYear === 'undefined'){window.filterBySelectedYear = items => items || []; window.ensureYearFilter = () => {};}
if(typeof caricaConfronto === 'undefined'){window.caricaConfronto = async () => null; window.renderConfrontoPersonale = () => '';}
const list = document.getElementById("allenamentiList");
const searchInput = document.getElementById("searchInput");
const deleteAllBtn = document.getElementById("deleteAllBtn");
let allenamenti = [];

caricaAllenamenti();

searchInput?.addEventListener("input", render);
deleteAllBtn?.addEventListener("click", eliminaTutti);

async function caricaAllenamenti(){
    const res = await fetch("/api/allenamenti");
    allenamenti = await res.json();
    ensureYearFilter(allenamenti, render);
    render();
}

function render(){
    const q = (searchInput?.value || "").toLowerCase();

    const filtrati = filterBySelectedYear(allenamenti).filter(a => {
        const txt = `${a.data} ${a.tipo_arco} ${a.tipo_allenamento} ${a.distanza || ""} ${a.piazzole || ""} ${a.punteggio || ""}`.toLowerCase();
        return txt.includes(q);
    });

    if(filtrati.length === 0){
        list.innerHTML = `<div class="empty-archive">Nessun allenamento trovato</div>`;
        return;
    }

    list.innerHTML = filtrati.map(a => `
        <div class="archive-card">
            <div class="archive-layout">
                <div class="archive-info">
                    <h2>${titoloAllenamento(a)}</h2>
                    <p>${formatDate(a.data)} · ${a.tipo_arco}</p>
                </div>

                <div class="archive-highlight">
                    <div>
                        <span>Punteggio</span>
                        <strong>${a.punteggio || 0}</strong>
                    </div>
                    <div>
                        <span>${labelsAllenamento(a)[0]}</span>
                        <strong>${specialA(a)}</strong>
                    </div>
                    <div>
                        <span>${labelsAllenamento(a)[1]}</span>
                        <strong>${specialB(a)}</strong>
                    </div>
                </div>

                <div class="archive-side">
                    <div class="archive-tags">
                        <span class="tag gara-${slugAllenamento(a.tipo_allenamento)}">${a.tipo_allenamento}</span>
                        <span class="tag arco-${slugAllenamento(a.tipo_arco)}">${a.tipo_arco}</span>
                        ${a.distanza ? `<span class="tag distance-tag">${a.distanza}m</span>` : ""}
                        ${a.piazzole ? `<span class="tag distance-tag">${a.piazzole} piazzole</span>` : ""}
                    </div>

                    <div class="archive-buttons">
                        <button class="score-btn" onclick="apriScoreAllenamento(${a.id})">Vedi Score</button>
                        <button onclick="location.href='/allenamento.html?edit=${a.id}'">Modifica</button>
                        <button class="danger-small" onclick="eliminaAllenamento(${a.id})">Elimina</button>
                    </div>
                </div>
            </div>
        </div>
    `).join("");
}

function confermaAzione({title,text,okText="Elimina"}){
    return new Promise(resolve => {
        const modal = document.getElementById("confirmModal");
        const titleEl = document.getElementById("confirmTitle");
        const textEl = document.getElementById("confirmText");
        const cancelBtn = document.getElementById("confirmCancel");
        const okBtn = document.getElementById("confirmOk");

        titleEl.textContent = title;
        textEl.textContent = text;
        okBtn.textContent = okText;

        modal.classList.remove("hidden");

        const cleanup = result => {
            modal.classList.add("hidden");
            cancelBtn.onclick = null;
            okBtn.onclick = null;
            resolve(result);
        };

        cancelBtn.onclick = () => cleanup(false);
        okBtn.onclick = () => cleanup(true);
    });
}

async function eliminaAllenamento(id){
    const ok = await confermaAzione({
        title:"Eliminare allenamento?",
        text:"Questa azione cancellerà l'allenamento e il suo score.",
        okText:"Elimina"
    });

    if(!ok) return;

    await fetch(`/api/allenamenti/${id}`, { method:"DELETE" });
    allenamenti = allenamenti.filter(a => a.id !== id);
    render();
}

async function eliminaTutti(){
    const ok = await confermaAzione({
        title:"Svuotare archivio allenamenti?",
        text:"Verranno eliminati tutti gli allenamenti salvati. Le gare non verranno toccate.",
        okText:"Svuota archivio"
    });

    if(!ok) return;

    for(const a of allenamenti){
        await fetch(`/api/allenamenti/${a.id}`, { method:"DELETE" });
    }

    allenamenti = [];
    render();
}
