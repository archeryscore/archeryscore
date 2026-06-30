if(typeof filterBySelectedYear === 'undefined'){window.filterBySelectedYear = items => items || []; window.ensureYearFilter = () => {};}
if(typeof caricaConfronto === 'undefined'){window.caricaConfronto = async () => null; window.renderConfrontoPersonale = () => '';}
const archiveList = document.getElementById("archiveList");
const searchArchive = document.getElementById("searchArchive");
const deleteAllBtn = document.getElementById("deleteAllBtn");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalContent = document.getElementById("modalContent");
const modalCancel = document.getElementById("modalCancel");
const modalConfirm = document.getElementById("modalConfirm");

let gare = [];
let confirmAction = null;

const paramsArchivio =
new URLSearchParams(window.location.search);

const scoreDaAprire =
paramsArchivio.get("score");


caricaArchivio();

if(searchArchive){
    searchArchive.addEventListener("input", renderArchivio);
}

if(deleteAllBtn){
    deleteAllBtn.addEventListener("click", () => {
        apriModal(
            "Cancellare tutto l'archivio?",
            "Questa azione eliminerà tutte le gare e tutti gli score salvati.",
            async () => {
                await fetch("/api/gare", { method:"DELETE" });
                mostraPopup("Archivio cancellato", "success");
                await caricaArchivio();
            }
        );
    });
}

if(modalCancel){
    modalCancel.addEventListener("click", chiudiModal);
}

if(modalConfirm){
    modalConfirm.addEventListener("click", async () => {
        if(confirmAction){
            await confirmAction();
        }

        chiudiModal();
    });
}

async function caricaArchivio(){
    try{
        const res = await fetch("/api/gare");
        gare = await res.json();

        ensureYearFilter(gare, renderArchivio);
        renderArchivio();

        if(scoreDaAprire){
            vediScore(scoreDaAprire);
        }

    }catch(err){
        console.error(err);
        archiveList.innerHTML = `<div class="empty-archive">Errore caricamento archivio</div>`;
    }
}

function renderArchivio(){
    const filtro = (searchArchive?.value || "").toLowerCase();

    const filtrate = filterBySelectedYear(gare).filter(g =>
        `${g.nome} ${g.luogo} ${g.tipo_gara} ${g.tipo_arco}`
        .toLowerCase()
        .includes(filtro)
    );

    if(filtrate.length === 0){
        archiveList.innerHTML = `<div class="empty-archive">Nessuna gara trovata</div>`;
        return;
    }

    archiveList.innerHTML = filtrate.map(g => `
        <div class="archive-card">

            <div class="archive-layout">

                <div class="archive-info">

                    <h2>${g.nome || "Gara senza nome"}</h2>

                    <p>
                        📍 ${g.luogo || "-"}
                        ·
                        🗓️ ${formatDate(g.data)}
                    </p>

                </div>

                ${creaHighlightArchivio(g)}

                <div class="archive-side">

                    <div class="archive-tags">

                        <span class="tag gara-${slug(g.tipo_gara)}">
                            ${formatTipoGara(g.tipo_gara || "-")}
                        </span>

                        <span class="tag arco-${slug(g.tipo_arco)}">
                            ${g.tipo_arco || "-"}
                        </span>

                        ${g.distanza ? `
                            <span class="tag distance-tag">
                                ${g.distanza}m
                            </span>
                        ` : ""}

                    </div>

                    <div class="archive-buttons">

                        <button class="score-btn" onclick="vediScore(${g.id})">
                            Vedi Score
                        </button>

                        <button onclick="modificaGara(${g.id})">
                            Modifica
                        </button>

                        <button class="danger-small" onclick="eliminaGara(${g.id})">
                            Elimina
                        </button>

                    </div>

                </div>

            </div>

        </div>
    `).join("");
}

function creaHighlightArchivio(gara){
    const labels = getSpecialLabelsArchivio(gara.tipo_gara);

    return `
        <div class="archive-highlight archive-highlight-card">

            
            ${creaSerieBoxesGeneriche(gara)}
<div>
                <span>Punteggio</span>
                <strong>${gara.punteggio || 0}</strong>
            </div>

            <div>
                <span>${labels[0]}</span>
                <strong>${getSpecialA(gara)}</strong>
            </div>

            <div>
                <span>${labels[1]}</span>
                <strong>${getSpecialB(gara)}</strong>
            </div>

        </div>
    `;
}

async function vediScore(id){
    try{
        const res = await fetch(`/api/gare/${id}`);
        const gara = await res.json();
        const confronto = await caricaConfronto('gara', id);

        apriModal(
            gara.nome || "Score gara",
            `
            <div class="modal-score-top">

                <div class="modal-race-info">
                    <p><strong>Data:</strong> ${formatDate(gara.data)}</p>
                    <p><strong>Luogo:</strong> ${gara.luogo || "-"}</p>
                    <p><strong>Tipo:</strong> ${formatTipoGara(gara.tipo_gara || "-")}</p>
                    <p><strong>Arco:</strong> ${gara.tipo_arco || "-"}</p>
                    ${gara.distanza ? `<p><strong>Distanza:</strong> ${gara.distanza}m</p>` : ""}
                </div>

                ${creaHighlightArchivio(gara)}

            </div>

            ${creaScoreArchivio(gara)}

            ${renderConfrontoPersonale(confronto)}
            `,
            null,
            false
        );
    }catch(err){
        console.error(err);
        mostraPopup("Errore apertura score", "error");
    }
}

function creaScoreArchivio(gara){
    if(!gara.score || gara.score.length === 0){
        return `<div class="empty-archive">Score non disponibile</div>`;
    }

    const isPercorso =
        gara.tipo_gara.includes("3D") ||
        gara.tipo_gara.includes("Campagna");

    const freccePerRiga =
        isPercorso
            ? 2
            : gara.tipo_gara.includes("Targa")
                ? 6
                : 3;

    const labels = getSpecialLabelsArchivio(gara.tipo_gara);
    const gruppi = {};

    gara.score.forEach(s => {
        const key = isPercorso
            ? `P${s.volee}`
            : `S${s.serie}-V${s.volee}`;

        if(!gruppi[key]){
            gruppi[key] = [];
        }

        gruppi[key].push(s);
    });

    const progressivo = {};
    let html = `<div class="score-view-official">`;

    Object.keys(gruppi).forEach(key => {
        const frecce = gruppi[key].sort(
            (a,b) => Number(a.freccia) - Number(b.freccia)
        );

        const serieKey = isPercorso ? "percorso" : key.split("-")[0];

        if(!progressivo[serieKey]){
            progressivo[serieKey] = 0;
        }

        let totale = 0;
        let specialA = 0;
        let specialB = 0;

        frecce.forEach(f => {
            totale += scoreValueArchivio(f.valore);

            const sp = contaSpecialiArchivio(gara.tipo_gara, f.valore);

            specialA += sp.a;
            specialB += sp.b;
        });

        progressivo[serieKey] += totale;

        html += `
            <div
                class="archive-score-row"
                style="grid-template-columns:90px repeat(${freccePerRiga},48px) 60px 70px 76px 76px;">

                <strong>${key}</strong>
        `;

        for(let i = 0; i < freccePerRiga; i++){
            const valore = frecce[i]?.valore || "";

            html += `
                <span class="archive-arrow ${scoreColorClassArchivio(gara.tipo_gara, valore)}">
                    ${valore}
                </span>
            `;
        }

        html += `
                <span class="archive-total">${totale}</span>
                <span class="archive-progressive">${progressivo[serieKey]}</span>
                <span class="archive-special">${labels[0]}: ${specialA}</span>
                <span class="archive-special">${labels[1]}: ${specialB}</span>
            </div>
        `;
    });

    html += `</div>`;

    return html;
}

function modificaGara(id){
    window.location.href = `gare.html?edit=${id}`;
}

function eliminaGara(id){
    apriModal(
        "Eliminare questa gara?",
        "La gara e il relativo score verranno cancellati definitivamente.",
        async () => {
            await fetch(`/api/gare/${id}`, { method:"DELETE" });
            mostraPopup("Gara eliminata", "success");
            await caricaArchivio();
        }
    );
}

function apriModal(title, content, action, showConfirm = true){
    modalTitle.textContent = title;
    modalContent.innerHTML = content;
    confirmAction = action;

    modalConfirm.style.display = showConfirm ? "inline-block" : "none";
    modalCancel.textContent = showConfirm ? "Annulla" : "Chiudi";

    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function chiudiModal(){
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    confirmAction = null;
}

function mostraPopup(testo, tipo = "success"){
    const popup = document.getElementById("popup");
    const popupText = document.getElementById("popupText");
    const popupIcon = document.getElementById("popupIcon");

    if(!popup || !popupText || !popupIcon){
        return;
    }

    popupText.textContent = testo;
    popup.classList.remove("hidden", "popup-success", "popup-error");

    if(tipo === "success"){
        popup.classList.add("popup-success");
        popupIcon.textContent = "✅";
    }else{
        popup.classList.add("popup-error");
        popupIcon.textContent = "⚠️";
    }

    setTimeout(() => {
        popup.classList.add("hidden");
    }, 3000);
}

function formatDate(date){
    if(!date) return "-";

    const d = new Date(date);

    return d.toLocaleDateString("it-IT");
}

function formatTipoGara(tipo){
    if(tipo === "3D 24") return "3D 24 piazzole";
    if(tipo === "3D 48") return "3D 48 piazzole";
    if(tipo === "Campagna/H&F 12+12") return "Campagna/H&F 12+12 (24 piazzole)";
    if(tipo === "Campagna/H&F 24+24") return "Campagna/H&F 24+24 (48 piazzole)";

    return tipo;
}

function slug(text){
    return String(text || "")
        .toLowerCase()
        .replaceAll("/", "")
        .replaceAll("&", "")
        .replaceAll("+", "")
        .replaceAll(" ", "-");
}

function scoreValueArchivio(value){
    if(value === "M" || !value) return 0;
    if(value === "X") return 10;
    return Number(value);
}

function contaSpecialiArchivio(tipo, value){
    if(tipo.includes("Targa")){
        return {
            a: value === "X" || value === "10" ? 1 : 0,
            b: value === "X" ? 1 : 0
        };
    }

    if(tipo.includes("Indoor")){
        return {
            a: value === "10" ? 1 : 0,
            b: value === "9" ? 1 : 0
        };
    }

    if(tipo.includes("3D")){
        return {
            a: value === "11" ? 1 : 0,
            b: value === "10" ? 1 : 0
        };
    }

    if(tipo.includes("Campagna")){
        return {
            a: value === "6" ? 1 : 0,
            b: value === "5" ? 1 : 0
        };
    }

    return { a:0, b:0 };
}

function getSpecialLabelsArchivio(tipo){
    if(tipo.includes("Targa")) return ["X+10", "X"];
    if(tipo.includes("Indoor")) return ["10", "9"];
    if(tipo.includes("3D")) return ["11", "10"];
    if(tipo.includes("Campagna")) return ["6", "5"];
    return ["Max1", "Max2"];
}

function scoreColorClassArchivio(tipo, value){
    if(!value) return "";

    if(tipo.includes("3D")){
        if(value === "11") return "green-score";
        if(value === "10") return "yellow-score";
        if(value === "8") return "red-score";
        if(value === "5") return "blue-score";
        return "white-score";
    }

    if(tipo.includes("Campagna")){
        if(value === "6" || value === "5") return "yellow-score";
        if(["4","3","2","1"].includes(value)) return "black-score";
        return "white-score";
    }

    if(["X","10","9"].includes(value)) return "yellow-score";
    if(["8","7"].includes(value)) return "red-score";
    if(["6","5"].includes(value)) return "blue-score";
    if(["4","3"].includes(value)) return "black-score";
    return "white-score";
}

function getSpecialA(g){
    if(g.tipo_gara?.includes("3D")){
        return g.eleven_count || 0;
    }

    return g.ten_count || 0;
}

function getSpecialB(g){
    if(g.tipo_gara?.includes("Targa")){
        return g.x_count || 0;
    }

    if(g.tipo_gara?.includes("3D")){
        return g.ten_count || 0;
    }

    if(g.tipo_gara?.includes("Indoor")){
        return g.nine_count || g.miss_count || 0;
    }

    if(g.tipo_gara?.includes("Campagna")){
        return g.five_count || g.miss_count || 0;
    }

    return g.x_count || 0;
}

function creaSerieBoxesGeneriche(gara){
    if(!gara.score || gara.score.length === 0){
        return "";
    }

    const isPercorso =
        String(gara.tipo_gara || "").includes("3D") ||
        String(gara.tipo_gara || "").includes("Campagna");

    const totals = {};

    gara.score.forEach(s => {
        const key = isPercorso
            ? `P${s.volee || s.serie || 1}`
            : `S${s.serie || 1}`;

        if(!totals[key]){
            totals[key] = 0;
        }

        totals[key] += scoreValueGenericForSerie(s.valore);
    });

    const keys = Object.keys(totals)
        .sort((a,b) => {
            const na = Number(String(a).replace(/\D/g,""));
            const nb = Number(String(b).replace(/\D/g,""));
            return na - nb;
        });

    return keys.map((key,index) => `
        <div>
            <span>${isPercorso ? key : "Serie " + (index + 1)}</span>
            <strong>${totals[key]}</strong>
        </div>
    `).join("");
}

function scoreValueGenericForSerie(v){
    const value = String(v || "").toUpperCase();

    if(value === "X") return 10;
    if(value === "M" || value === "") return 0;

    return Number(value) || 0;
}
