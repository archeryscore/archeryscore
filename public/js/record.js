if(typeof filterBySelectedYear === 'undefined'){window.filterBySelectedYear = items => items || []; window.ensureYearFilter = () => {};}
if(typeof caricaConfronto === 'undefined'){window.caricaConfronto = async () => null; window.renderConfrontoPersonale = () => '';}
const recordList = document.getElementById("recordList");
const searchRecord = document.getElementById("searchRecord");

let gare = [];

creaModalRecord();
caricaRecord();

if(searchRecord){
    searchRecord.addEventListener("input", renderRecord);
}

async function caricaRecord(){
    try{
        const res = await fetch("/api/gare");
        gare = await res.json();
        ensureYearFilter(gare, renderRecord);
        renderRecord();
    }catch(err){
        console.error(err);
        recordList.innerHTML = `<div class="empty-archive">Errore caricamento record</div>`;
    }
}

function renderRecord(){
    const filtro = (searchRecord?.value || "").toLowerCase();
    const gruppi = raggruppaGare(filterBySelectedYear(gare));

    const records = Object.values(gruppi)
        .map(gruppo => creaRecord(gruppo))
        .filter(r =>
            `${r.tipo_gara} ${r.tipo_arco} ${r.distanzaLabel}`
            .toLowerCase()
            .includes(filtro)
        )
        .sort((a,b) => Number(b.best.punteggio || 0) - Number(a.best.punteggio || 0));

    if(records.length === 0){
        recordList.innerHTML = `<div class="empty-archive">Nessun record disponibile</div>`;
        return;
    }

    recordList.innerHTML = records.map(r => creaCardRecord(r)).join("");
}

function raggruppaGare(lista){
    const gruppi = {};

    lista.forEach(g => {
        const distanza = g.distanza || "standard";
        const key = [g.tipo_gara, g.tipo_arco, distanza].join("|");

        if(!gruppi[key]){
            gruppi[key] = [];
        }

        gruppi[key].push(g);
    });

    return gruppi;
}

function creaRecord(gruppo){
    const ordinate = [...gruppo].sort(
        (a,b) => Number(b.punteggio || 0) - Number(a.punteggio || 0)
    );

    const best = ordinate[0];
    const worst = ordinate[ordinate.length - 1];

    const totale = gruppo.reduce(
        (sum,g) => sum + Number(g.punteggio || 0),
        0
    );

    return {
        tipo_gara: formatTipoGara(best.tipo_gara || "-"),
        tipo_gara_originale: best.tipo_gara || "-",
        tipo_arco: best.tipo_arco || "-",
        distanza: best.distanza || null,
        distanzaLabel: best.distanza ? best.distanza + "m" : "standard",
        best,
        worst,
        media: gruppo.length > 0 ? totale / gruppo.length : 0,
        numero: gruppo.length
    };
}

function creaCardRecord(r){
    const labels = getSpecialLabelsRecord(r.tipo_gara_originale);

    return `
        <div class="record-card">

            <div class="record-header">

                <div>
                    <h2>${r.tipo_gara}</h2>
                    <p>
                        ${r.tipo_arco}
                        ${r.distanza ? " · " + r.distanza + "m" : ""}
                    </p>
                </div>

                <div class="record-badge">
                    ${r.numero} ${r.numero === 1 ? "gara" : "gare"}
                </div>

            </div>

            <div class="record-grid">

                <div class="record-box best-record">
                    <span>Miglior punteggio</span>
                    <strong>${r.best.punteggio || 0}</strong>
                    <small>${formatDate(r.best.data)} · ${r.best.luogo || "-"}</small>

                    <button
                        class="record-view-btn"
                        onclick="vediScoreRecord(${r.best.id})">
                        Vedi
                    </button>
                </div>

                <div class="record-box">
                    <span>${labels[0]}</span>
                    <strong>${getSpecialA(r.best)}</strong>
                    <small>nel miglior punteggio</small>
                </div>

                <div class="record-box">
                    <span>${labels[1]}</span>
                    <strong>${getSpecialB(r.best)}</strong>
                    <small>nel miglior punteggio</small>
                </div>

                <div class="record-box worst-record">
                    <span>Peggior punteggio</span>
                    <strong>${r.worst.punteggio || 0}</strong>
                    <small>${formatDate(r.worst.data)} · ${r.worst.luogo || "-"}</small>

                    <button
                        class="record-view-btn"
                        onclick="vediScoreRecord(${r.worst.id})">
                        Vedi
                    </button>
                </div>

                <div class="record-box">
                    <span>Media</span>
                    <strong>${r.media.toFixed(1)}</strong>
                    <small>punteggio medio</small>
                </div>

            </div>

        </div>
    `;
}

async function vediScoreRecord(id){
    try{
        const res = await fetch(`/api/gare/${id}`);
        const gara = await res.json();
        const confronto = await caricaConfronto('gara', id);

        document.getElementById("recordModalTitle").textContent =
            gara.nome || "Score gara";

        document.getElementById("recordModalContent").innerHTML = `
            <div class="modal-score-top">

                <div class="modal-race-info">
                    <p><strong>Data:</strong> ${formatDate(gara.data)}</p>
                    <p><strong>Luogo:</strong> ${gara.luogo || "-"}</p>
                    <p><strong>Tipo:</strong> ${formatTipoGara(gara.tipo_gara || "-")}</p>
                    <p><strong>Arco:</strong> ${gara.tipo_arco || "-"}</p>
                    ${gara.distanza ? `<p><strong>Distanza:</strong> ${gara.distanza}m</p>` : ""}
                </div>

                ${creaHighlightRecord(gara)}

            </div>

            ${creaScoreRecord(gara)}

            ${renderConfrontoPersonale(confronto)}
        `;

        document.getElementById("recordModal").classList.remove("hidden");
        document.body.classList.add("modal-open");

    }catch(err){
        console.error(err);
        alert("Errore apertura score");
    }
}

function creaModalRecord(){
    if(document.getElementById("recordModal")){
        return;
    }

    const div = document.createElement("div");

    div.innerHTML = `
        <div id="recordModal" class="modal hidden">
            <div class="modal-box">
                <h2 id="recordModalTitle"></h2>

                <div id="recordModalContent"></div>

                <div class="modal-actions">
                    <button
                        class="secondary-btn"
                        onclick="chiudiModalRecord()">
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(div.firstElementChild);
}

function chiudiModalRecord(){
    document.getElementById("recordModal").classList.add("hidden");
    document.body.classList.remove("modal-open");
}

function creaHighlightRecord(gara){
    const labels = getSpecialLabelsRecord(gara.tipo_gara);

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

function creaScoreRecord(gara){
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

    const labels = getSpecialLabelsRecord(gara.tipo_gara);
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
            totale += scoreValueRecord(f.valore);

            const sp = contaSpecialiRecord(gara.tipo_gara, f.valore);

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
                <span class="archive-arrow ${scoreColorClassRecord(gara.tipo_gara, valore)}">
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

function getSpecialLabelsRecord(tipo){
    if(tipo.includes("Targa")) return ["X+10","X"];
    if(tipo.includes("Indoor")) return ["10","9"];
    if(tipo.includes("3D")) return ["11","10"];
    if(tipo.includes("Campagna")) return ["6","5"];
    return ["Max 1","Max 2"];
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

function scoreValueRecord(value){
    if(value === "M" || !value) return 0;
    if(value === "X") return 10;
    return Number(value);
}

function contaSpecialiRecord(tipo, value){
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

function scoreColorClassRecord(tipo, value){
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
