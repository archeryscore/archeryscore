const tipoGara = document.getElementById("tipo_gara");
const tipoArco = document.getElementById("tipo_arco");
const distanza = document.getElementById("distanza");
const indirizzo =document.getElementById("indirizzo");
const distanceContainer = document.getElementById("distanceContainer");
const btnFitarco = document.getElementById("btnFitarco");
const tipoGaraContainer = document.getElementById("tipoGaraContainer");
const scoreContainer = document.getElementById("scoreContainer");
const keyboardLegend = document.getElementById("keyboardLegend");
const generaScoreBtn = document.getElementById("generaScore");
const garaDetails = document.getElementById("garaDetails");
const garaTypeBanner = document.getElementById("garaTypeBanner");
const pageTitle = document.getElementById("pageTitle");

const params = new URLSearchParams(window.location.search);
const editId = params.get("edit");

let modalitaModifica = Boolean(editId);
let targaAllApertoFitarco = false;
let distanzaAllApertoFitarco = "";

const archi = {
    "Indoor 18m":["Olimpico","Compound","Arco Nudo","Longbow"],
    "Indoor 25m":["Olimpico","Compound","Arco Nudo","Longbow"],
    "Indoor 18+25":["Olimpico","Compound","Arco Nudo","Longbow"],
    "Indoor all-aperto 😉":["Olimpico","Compound","Arco Nudo","Longbow"],
    "Targa":["Olimpico","Compound","Arco Nudo","Longbow"],
    "Targa all-aperto":["Olimpico","Compound","Arco Nudo","Longbow"],
    "Targa 18m":["Olimpico","Compound","Arco Nudo","Longbow"],
    "Targa 25m":["Olimpico","Compound","Arco Nudo","Longbow"],
    "Targa 18+25m":["Olimpico","Compound","Arco Nudo","Longbow"],
    "Doppio Targa":["Olimpico","Compound","Arco Nudo","Longbow"],
    "Campagna/H&F 12+12":["Olimpico","Compound","Arco Nudo","Longbow"],
    "Campagna/H&F 24+24":["Olimpico","Compound","Arco Nudo","Longbow"],
    "3D 24":["Compound","Arco Nudo","Longbow","Istintivo"],
    "3D 48":["Compound","Arco Nudo","Longbow","Istintivo"]
};


garantisciRegoleTargaOutdoor();

function garantisciRegoleTargaOutdoor(){
    if(typeof RULES === "undefined") return;

    if(!RULES["Targa 18m"]){
        RULES["Targa 18m"] = {
            series:2,
            volleysPerSeries:10,
            arrowsPerVolley:3,
            distances:[18,18],
            allowed:["M","1","2","3","4","5","6","7","8","9","10"],
            shortcuts:{ "+":"10" }
        };
    }

    if(!RULES["Targa 25m"]){
        RULES["Targa 25m"] = {
            series:2,
            volleysPerSeries:10,
            arrowsPerVolley:3,
            distances:[25,25],
            allowed:["M","1","2","3","4","5","6","7","8","9","10"],
            shortcuts:{ "+":"10" }
        };
    }

    if(!RULES["Targa 18+25m"]){
        RULES["Targa 18+25m"] = {
            series:4,
            volleysPerSeries:10,
            arrowsPerVolley:3,
            distances:[18,18,25,25],
            allowed:["M","1","2","3","4","5","6","7","8","9","10"],
            shortcuts:{ "+":"10" }
        };
    }
}



tipoGara?.addEventListener("change", () => {
    aggiornaCampi();
    mostraTipoGaraBanner(tipoGara.value);
});

tipoArco?.addEventListener("change", aggiornaDistanze);
btnFitarco?.addEventListener("click", caricaFitarco);
generaScoreBtn?.addEventListener("click", generaScore);

inizializzaPagina();

function inizializzaPagina(){
    aggiornaCampi();

    if(editId){
        mostraDettagliGara();
        caricaGaraDaModificare(editId);
    }else{
        nascondiDettagliGara();
    }
}

function mostraDettagliGara(){
    garaDetails?.classList.remove("hidden");
}

function nascondiDettagliGara(){
    garaDetails?.classList.add("hidden");
    scoreContainer.innerHTML = "";
    keyboardLegend.classList.add("hidden");
    keyboardLegend.innerHTML = "";
}


function garantisciOpzioneTipoGara(tipo){
    if(!tipoGara || !tipo){
        return;
    }

    const esiste =
    Array.from(tipoGara.options).some(opt => opt.value === tipo);

    if(esiste){
        return;
    }

    const opt =
    document.createElement("option");

    opt.value =
    tipo;

    opt.textContent =
    tipo;

    tipoGara.appendChild(opt);
}

function aggiornaCampi(){
    if(!tipoArco || !tipoGara) return;

    tipoArco.innerHTML = "";

    const lista = archi[tipoGara.value];

    if(!lista){
        distanceContainer.style.display = "none";
        return;
    }

    lista.forEach(arco => {
        const opt = document.createElement("option");
        opt.value = arco;
        opt.textContent = arco;
        tipoArco.appendChild(opt);
    });

    aggiornaDistanze();
}

function aggiornaDistanze(){

    if(!distanza || !distanceContainer || !tipoGara || !tipoArco){
        return;
    }

    distanza.innerHTML = "";

    const gara = tipoGara.value;
    const arco = tipoArco.value;

    if(
        (gara.includes("Indoor") && gara !== "Indoor all-aperto 😉") ||
        gara.includes("3D") ||
        gara.includes("Campagna")
    ){
        distanceContainer.style.display = "none";
        return;
    }

    distanceContainer.style.display = "flex";

    let distanze = [];

    if(gara === "Indoor all-aperto 😉"){
        distanze = distanzaAllApertoFitarco
            ? [distanzaAllApertoFitarco]
            : ["18","25","18+25"];
    }else{
        distanze =
            arco === "Olimpico"
                ? ["20","30","40","50","60","70"]
                : ["20","30","40","50"];
    }

    distanze.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d + " m";
        distanza.appendChild(opt);
    });

    if(distanze.length === 1){
        distanza.value = distanze[0];
    }
}

function aggiungiDistanzaFissa(valore){
    const opt = document.createElement("option");
    opt.value = valore;
    opt.textContent = valore + " m";
    distanza.appendChild(opt);
    distanza.value = valore;
}

async function caricaFitarco(){
    return caricaFitarcoAsync();
}

async function caricaFitarcoAsync(){
    const codice = document.getElementById("codice_gara").value.trim().toUpperCase();

    if(!codice){
        mostraPopup("Inserisci un codice gara", "error");
        return;
    }

    try{
        const res = await fetch("/api/fitarco/" + codice);
        const dati = await res.json();

        if(!dati.success){
            mostraPopup("Gara non trovata", "error");
            return;
        }

        document.getElementById("nome").value = dati.nome || "";
        document.getElementById("data").value = dati.data || "";
        document.getElementById("luogo").value = dati.luogo || "";

        if(indirizzo){
            indirizzo.value = dati.indirizzo || "";
        }

        const tipoCorretto =
        normalizzaTipoGaraFrontend(dati.tipo_gara, dati.distanza, dati);

        const tipoDaUsare =
        tipoCorretto && archi[tipoCorretto]
            ? tipoCorretto
            : "Targa";

        garantisciOpzioneTipoGara(tipoDaUsare);

        tipoGara.value =
        tipoDaUsare;

        targaAllApertoFitarco =
        tipoGara.value === "Indoor all'aperto 😉";

        distanzaAllApertoFitarco =
        targaAllApertoFitarco
            ? normalizzaDistanzaIndoorAperto(dati.distanza, dati.nome, dati.tipo_gara)
            : "";

        aggiornaCampi();

        if(distanza){
            if(distanzaAllApertoFitarco){
                distanza.value = distanzaAllApertoFitarco;
            }else if(dati.distanza){
                distanza.value = dati.distanza === "25+18" ? "18+25" : dati.distanza;
            }
        }

        gestisciCampiDaFitarco(tipoGara.value);
        mostraTipoGaraBanner(tipoGara.value);
        mostraDettagliGara();

        mostraPopup("Gara caricata", "success");

    }catch(err){
        console.error(err);
        mostraPopup("Errore caricamento gara", "error");
    }
}

function gestisciCampiDaFitarco(tipo){
    if(tipoGaraContainer){
        tipoGaraContainer.style.display = "none";
    }

    if(tipo === "Targa" || tipo === "Indoor all'aperto 😉" || tipo === "Doppio Targa"){
        distanceContainer.style.display = "flex";
    }else{
        distanceContainer.style.display = "none";
    }
}

function mostraTipoGaraBanner(tipo){
    if(!garaTypeBanner) return;

    if(!tipo){
        garaTypeBanner.textContent = "Tipo gara non riconosciuto";
        garaTypeBanner.className = "gara-type-banner banner-unknown";
        return;
    }

    let testo = tipo;

    if(tipo === "Targa") testo = "Targa";

    if(tipo === "Indoor all'aperto 😉"){
        const d = distanza?.value || distanzaAllApertoFitarco || "";
        testo = d ? `Indoor all'aperto 😉 ${d} metri` : "Indoor all'aperto 😉";
    }

    if(tipo === "3D 24") testo = "3D 24 piazzole";
    if(tipo === "3D 48") testo = "3D 48 piazzole";
    if(tipo === "Campagna/H&F 12+12") testo = "Campagna/H&F 12+12 - 24 piazzole";
    if(tipo === "Campagna/H&F 24+24") testo = "Campagna/H&F 24+24 - 48 piazzole";
    if(tipo === "Indoor 18m") testo = "Indoor 18 metri";
    if(tipo === "Indoor 25m") testo = "Indoor 25 metri";
    if(tipo === "Indoor 18+25") testo = "Indoor 18+25 metri";

    garaTypeBanner.textContent = testo;
    garaTypeBanner.className = "gara-type-banner banner-" + slug(tipo);
}

function generaScore(){
    const tipo = tipoGara.value;
    const tipoScore = tipoScoreDaScelta();

    if(!tipo){
        mostraPopup("Seleziona un tipo gara", "error");
        return;
    }

    const rule = RULES[tipoScore];

    if(!rule){
        mostraPopup("Regole gara non trovate", "error");
        return;
    }

    scoreContainer.innerHTML = "";
    keyboardLegend.innerHTML = "";

    mostraTipoGaraBanner(tipo);
    generaLegenda(tipoScore, rule);

    if(rule.targets){
        generaPercorso(tipoScore, rule);
    }else{
        generaBersaglio(tipoScore, rule);
    }

    keyboardLegend.classList.remove("hidden");

    attivaScore(tipoScore, rule);
    aggiornaScore(tipoScore, rule);
}

function generaLegenda(tipo, rule){
    let html = `
        <div class="legend-title">Scorciatoie Tastiera</div>
        <div class="legend-row">
    `;

    if(rule.shortcuts){
        Object.keys(rule.shortcuts).forEach(key => {
            html += `<div class="legend-key">${key} → ${rule.shortcuts[key]}</div>`;
        });
    }

    if(rule.allowed && rule.allowed.includes("X")){
        html += `<div class="legend-key">X → X</div>`;
    }

    html += `
        <div class="legend-key">M → Miss</div>
        <div class="legend-key">valore valido → prossima casella</div>
        </div>
    `;

    keyboardLegend.innerHTML = html;
}

function generaBersaglio(tipo, rule){
    const labels = getSpecialLabels(tipo);
    let html = `<div class="score-grid">`;

    for(let s = 1; s <= rule.series; s++){
        const labelDistanza = rule.distances && rule.distances[s - 1]
            ? ` - ${rule.distances[s - 1]}m`
            : "";

        const columns =
            `52px repeat(${rule.arrowsPerVolley}, minmax(34px, 1fr)) 52px 58px 60px 60px`;

        html += `
            <div class="score-card">
                <h2>Serie ${s}${labelDistanza}</h2>

                <div class="score-header" style="grid-template-columns:${columns};">
                    <div>Vol</div>
        `;

        for(let a = 1; a <= rule.arrowsPerVolley; a++){
            html += `<div>F${a}</div>`;
        }

        html += `
                    <div>Tot</div>
                    <div>Prog</div>
                    <div>${labels[0]}</div>
                    <div>${labels[1]}</div>
                </div>
        `;

        for(let v = 1; v <= rule.volleysPerSeries; v++){
            html += `
                <div
                    class="volley-row score-row"
                    data-serie="${s}"
                    data-volley="${v}"
                    style="grid-template-columns:${columns};">

                    <span>V${v}</span>
            `;

            for(let a = 1; a <= rule.arrowsPerVolley; a++){
                html += `
                    <input
                        class="arrow-input"
                        maxlength="2"
                        data-serie="${s}"
                        data-volley="${v}"
                        data-arrow="${a}">
                `;
            }

            html += `
                    <div class="volley-total">0</div>
                    <div class="volley-progressive">0</div>
                    <div class="volley-special special-a">0</div>
                    <div class="volley-special special-b">0</div>
                </div>
            `;
        }

        html += `
            <div class="series-summary" data-serie-summary="${s}">
                <span>Totale serie: <strong class="serie-total">0</strong></span>
                <span>${labels[0]}: <strong class="serie-special-a">0</strong></span>
                <span>${labels[1]}: <strong class="serie-special-b">0</strong></span>
            </div>
        </div>
        `;
    }

    html += `
        </div>
        <div id="summaryContainer" class="summary-card"></div>
    `;

    scoreContainer.innerHTML = html;
}

function generaPercorso(tipo, rule){
    const labels = getSpecialLabels(tipo);

    const columns = tipo.includes("Campagna")
        ? `90px repeat(3, minmax(34px, 1fr)) 52px 58px 52px 52px`
        : `90px repeat(2, minmax(34px, 1fr)) 52px 58px 58px 58px`;

    const meta = Math.ceil(rule.targets / 2);

    let html = `<div class="score-grid">`;

    for(let gruppo = 0; gruppo < 2; gruppo++){
        const start = gruppo === 0 ? 1 : meta + 1;
        const end = gruppo === 0 ? meta : rule.targets;

        html += `
            <div class="score-card">
                <h2>${tipo.includes("3D") ? "3D" : "H&F"} - Piazzole ${start}-${end}</h2>

                <div class="score-header" style="grid-template-columns:${columns};">
                    <div>Piazzola</div>
        `;

        for(let a = 1; a <= rule.arrowsPerTarget; a++){
            html += `<div>F${a}</div>`;
        }

        html += `
                    <div>Tot</div>
                    <div>Prog</div>
                    <div>${labels[0]}</div>
                    <div>${labels[1]}</div>
                </div>
        `;

        for(let p = start; p <= end; p++){
            html += `
                <div
                    class="volley-row score-row"
                    data-target="${p}"
                    style="grid-template-columns:${columns};">

                    <span>P${p}</span>
            `;

            for(let a = 1; a <= rule.arrowsPerTarget; a++){
                html += `
                    <input
                        class="arrow-input"
                        maxlength="2"
                        data-target="${p}"
                        data-arrow="${a}">
                `;
            }

            html += `
                    <div class="volley-total">0</div>
                    <div class="volley-progressive">0</div>
                    <div class="volley-special special-a">0</div>
                    <div class="volley-special special-b">0</div>
                </div>
            `;
        }

        html += `</div>`;
    }

    html += `
        </div>
        <div id="summaryContainer" class="summary-card"></div>
    `;

    scoreContainer.innerHTML = html;
}
function attivaScore(tipo, rule){
    const inputs = document.querySelectorAll(".arrow-input");

    inputs.forEach((input, index) => {
        input.addEventListener("input", () => {
            formatInput(input, tipo, rule, inputs, index);
            aggiornaScore(tipo, rule);
        });

        input.addEventListener("keydown", event => {
            if(event.key === "ArrowRight"){
                event.preventDefault();
                focusNext(inputs, index);
            }

            if(event.key === "ArrowLeft"){
                event.preventDefault();
                focusPrev(inputs, index);
            }
        });
    });
}

function formatInput(input, tipo, rule, inputs, index){
    let value = input.value.trim().toUpperCase();

    input.className = "arrow-input";

    if(!value) return;

    if(rule.shortcuts && rule.shortcuts[value]){
        value = rule.shortcuts[value];
    }

    if(value === "X" && !tipo.includes("Targa")){
        input.value = "";
        return;
    }

    if(!rule.allowed.includes(value)){
        input.value = "";
        return;
    }

    input.value = value;

    applicaColore(input, value, tipo);
    focusNext(inputs, index);
}

function focusNext(inputs, index){
    if(index < inputs.length - 1){
        inputs[index + 1].focus();
        inputs[index + 1].select();
    }
}

function focusPrev(inputs, index){
    if(index > 0){
        inputs[index - 1].focus();
        inputs[index - 1].select();
    }
}

function aggiornaScore(tipo, rule){
    const rows = document.querySelectorAll(".score-row");

    let totaleGara = 0;
    let frecceCompilate = 0;
    let righeComplete = 0;
    let specialTotA = 0;
    let specialTotB = 0;

    const serieData = {};

    rows.forEach(row => {
        const inputs = row.querySelectorAll(".arrow-input");

        let totaleRiga = 0;
        let specialA = 0;
        let specialB = 0;
        let rigaCompleta = true;

        inputs.forEach(input => {
            const value = input.value.trim().toUpperCase();

            if(!value){
                rigaCompleta = false;
                return;
            }

            totaleRiga += scoreValue(value);

            const special = contaSpeciali(tipo, value);
            specialA += special.a;
            specialB += special.b;

            frecceCompilate++;
        });

        totaleGara += totaleRiga;
        specialTotA += specialA;
        specialTotB += specialB;

        if(rigaCompleta){
            righeComplete++;
        }

        row.querySelector(".volley-total").textContent = totaleRiga;
        row.querySelector(".special-a").textContent = specialA;
        row.querySelector(".special-b").textContent = specialB;

        const serie = row.dataset.serie || "percorso";

        if(!serieData[serie]){
            serieData[serie] = {
                total:0,
                specialA:0,
                specialB:0
            };
        }

        serieData[serie].total += totaleRiga;
        serieData[serie].specialA += specialA;
        serieData[serie].specialB += specialB;

        row.querySelector(".volley-progressive").textContent =
            serieData[serie].total;
    });

    Object.keys(serieData).forEach(serie => {
        const summary = document.querySelector(`[data-serie-summary="${serie}"]`);

        if(summary){
            summary.querySelector(".serie-total").textContent = serieData[serie].total;
            summary.querySelector(".serie-special-a").textContent = serieData[serie].specialA;
            summary.querySelector(".serie-special-b").textContent = serieData[serie].specialB;
        }
    });

    aggiornaRiepilogoFinale(
        tipo,
        totaleGara,
        frecceCompilate,
        righeComplete,
        specialTotA,
        specialTotB
    );
}

function aggiornaRiepilogoFinale(tipo, totale, frecce, vollee, specialA, specialB){
    const summary = document.getElementById("summaryContainer");

    if(!summary) return;

    summary.dataset.totale = String(totale);
    summary.dataset.specialA = String(specialA);
    summary.dataset.specialB = String(specialB);

    const labels = getSpecialLabels(tipo);

    const mediaFreccia = frecce > 0
        ? (totale / frecce).toFixed(2)
        : "0.00";

    const mediaVolee = vollee > 0
        ? (totale / vollee).toFixed(2)
        : "0.00";

    summary.innerHTML = `
        <h2>Riepilogo Gara</h2>

        <div class="summary-grid">

            <div class="summary-item">
                <div class="summary-value">${totale}</div>
                <div>Punteggio</div>
            </div>

            <div class="summary-item">
                <div class="summary-value">${specialA}</div>
                <div>${labels[0]}</div>
            </div>

            <div class="summary-item">
                <div class="summary-value">${specialB}</div>
                <div>${labels[1]}</div>
            </div>

            <div class="summary-item">
                <div class="summary-value">${mediaFreccia}</div>
                <div>Media freccia</div>
            </div>

            <div class="summary-item">
                <div class="summary-value">${mediaVolee}</div>
                <div>Media volée</div>
            </div>

        </div>
    `;

    aggiungiPulsanteSalva();
}

function scoreValue(value){
    if(value === "M" || !value) return 0;
    if(value === "X") return 10;
    return Number(value);
}

function contaSpeciali(tipo, value){
    if(isTargaOutdoor(tipo)){
        return { a: value === "10" ? 1 : 0, b: value === "9" ? 1 : 0 };
    }
    if(tipo.includes("Targa")){
        return { a: value === "X" || value === "10" ? 1 : 0, b: value === "X" ? 1 : 0 };
    }
    if(tipo.includes("Indoor")){
        return { a: value === "10" ? 1 : 0, b: value === "9" ? 1 : 0 };
    }
    if(tipo.includes("3D")){
        return { a: value === "11" ? 1 : 0, b: value === "10" ? 1 : 0 };
    }
    if(tipo.includes("Campagna")){
        return { a: value === "6" ? 1 : 0, b: value === "5" ? 1 : 0 };
    }
    return { a:0, b:0 };
}

function getSpecialLabels(tipo){
    if(isTargaOutdoor(tipo)) return ["10","9"];
    if(tipo.includes("Targa")) return ["X+10","X"];
    if(tipo.includes("Indoor")) return ["10","9"];
    if(tipo.includes("3D")) return ["11","10"];
    if(tipo.includes("Campagna")) return ["6","5"];
    return ["Max 1","Max 2"];
}

function applicaColore(input, value, tipo){
    input.className = "arrow-input";

    if(tipo.includes("3D")){
        if(value === "11") input.classList.add("green-score");
        else if(value === "10") input.classList.add("yellow-score");
        else if(value === "8") input.classList.add("red-score");
        else if(value === "5") input.classList.add("blue-score");
        else input.classList.add("white-score");

        return;
    }

    if(tipo.includes("Campagna")){
        if(value === "6" || value === "5") input.classList.add("yellow-score");
        else if(["4","3","2","1"].includes(value)) input.classList.add("black-score");
        else input.classList.add("white-score");

        return;
    }

    if(["X","10","9"].includes(value)) input.classList.add("yellow-score");
    else if(["8","7"].includes(value)) input.classList.add("red-score");
    else if(["6","5"].includes(value)) input.classList.add("blue-score");
    else if(["4","3"].includes(value)) input.classList.add("black-score");
    else input.classList.add("white-score");
}

function creaDatiScore(){
    const inputs = document.querySelectorAll(".arrow-input");
    const score = [];

    inputs.forEach(input => {
        score.push({
            serie: input.dataset.serie || input.dataset.target || 1,
            volee: input.dataset.volley || input.dataset.target || 1,
            freccia: input.dataset.arrow,
            valore: input.value.trim().toUpperCase()
        });
    });

    return score;
}

function aggiungiPulsanteSalva(){
    if(document.getElementById("salvaGara")){
        return;
    }

    const btn = document.createElement("button");

    btn.type = "button";
    btn.id = "salvaGara";
    btn.className = "generate-btn save-btn";
    btn.textContent = modalitaModifica ? "Salva Modifiche" : "Salva Gara";

    btn.addEventListener("click", salvaGara);

    scoreContainer.appendChild(btn);
}

async function salvaGara(){
    const tipo = tipoScoreDaScelta();
    const summary = document.getElementById("summaryContainer");

    if(!summary){
        mostraPopup("Genera prima lo score", "error");
        return;
    }

    const totale = Number(summary.dataset.totale || 0);
    const specialA = Number(summary.dataset.specialA || 0);
    const specialB = Number(summary.dataset.specialB || 0);

    const gara = {
    codice_gara: document.getElementById("codice_gara").value.trim().toUpperCase(),
    nome: document.getElementById("nome").value,
    data: document.getElementById("data").value,
    luogo: document.getElementById("luogo").value,
    indirizzo: indirizzo ? indirizzo.value.trim() : "",
    lat:null,
    lng:null,
        tipo_gara: tipo,
        tipo_arco: tipoArco.value,
        distanza: distanzaSalvataggio(tipo),
        punteggio: totale,
        x_count: tipo.includes("Targa") && !isTargaOutdoor(tipo) ? specialB : 0,
        ten_count: tipo.includes("3D")
            ? specialB
            : (tipo.includes("Targa") || tipo.includes("Indoor"))
                ? specialA
                : 0,
        eleven_count: tipo.includes("3D") ? specialA : 0,
        nine_count: (tipo.includes("Indoor") || isTargaOutdoor(tipo)) ? specialB : 0,
        five_count: tipo.includes("Campagna") ? specialB : 0,
        miss_count: tipo.includes("Campagna") ? specialB : 0,
        score: creaDatiScore()
    };

    try{
        const url = modalitaModifica ? `/api/gare/${editId}` : "/api/gare";
        const method = modalitaModifica ? "PUT" : "POST";

        const res = await fetch(url, {
            method,
            headers:{ "Content-Type":"application/json" },
            body:JSON.stringify(gara)
        });

        const result = await res.json();

        if(!result.success){
            mostraPopup("Errore salvataggio", "error");
            return;
        }

        mostraPopup(
            modalitaModifica ? "Gara modificata" : "Gara salvata",
            "success"
        );

        setTimeout(() => {
            window.location.href = "/";
        }, 1200);

    }catch(err){
        console.error(err);
        mostraPopup("Errore salvataggio gara", "error");
    }
}

async function caricaGaraDaModificare(id){
    try{
        const res = await fetch(`/api/gare/${id}`);
        const gara = await res.json();

        if(!gara || gara.success === false){
            mostraPopup("Gara non trovata", "error");
            return;
        }

        modalitaModifica = true;

        if(pageTitle){
            pageTitle.textContent = "Modifica Gara";
        }

        document.getElementById("codice_gara").value = gara.codice_gara || "";
        document.getElementById("nome").value = gara.nome || "";
        document.getElementById("data").value = gara.data || "";
        document.getElementById("luogo").value = gara.luogo || "";
		if(indirizzo){
    indirizzo.value = gara.indirizzo || "";
}

        const tipoSalvato = gara.tipo_gara || "";

        if(isTargaOutdoor(tipoSalvato) || tipoSalvato === "Indoor all'aperto 😉"){
            garantisciOpzioneTipoGara("Indoor all'aperto 😉");
            tipoGara.value = "Indoor all'aperto 😉";
            targaAllApertoFitarco = true;
            distanzaAllApertoFitarco = gara.distanza || "";
        }else{
            garantisciOpzioneTipoGara(tipoSalvato);
            tipoGara.value = tipoSalvato;
            targaAllApertoFitarco = false;
            distanzaAllApertoFitarco = "";
        }

        aggiornaCampi();

        tipoArco.value = gara.tipo_arco || "";

        aggiornaDistanze();

        if(gara.distanza){
            distanza.value = gara.distanza;
        }

        mostraDettagliGara();
        mostraTipoGaraBanner(tipoGara.value);

        generaScore();

        setTimeout(() => {
            riempiScoreSalvato(gara.score || []);
            aggiornaScore(tipoScoreDaScelta(), RULES[tipoScoreDaScelta()]);
        }, 100);

        mostraPopup("Gara caricata in modifica", "success");

    }catch(err){
        console.error(err);
        mostraPopup("Errore caricamento modifica", "error");
    }
}

function riempiScoreSalvato(score){
    score.forEach(r => {
        const isPercorso =
            tipoGara.value.includes("3D") ||
            tipoGara.value.includes("Campagna");

        const selector = isPercorso
            ? `.arrow-input[data-target="${r.volee}"][data-arrow="${r.freccia}"]`
            : `.arrow-input[data-serie="${r.serie}"][data-volley="${r.volee}"][data-arrow="${r.freccia}"]`;

        const input = document.querySelector(selector);

        if(input){
            input.value = r.valore;
            applicaColore(input, r.valore, tipoGara.value);
        }
    });
}

function mostraPopup(testo, tipo="success"){
    const popup = document.getElementById("popup");
    const popupText = document.getElementById("popupText");
    const popupIcon = document.getElementById("popupIcon");

    if(!popup || !popupText || !popupIcon){
        alert(testo);
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
function normalizzaTestoGara(value){
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g,"")
        .replace(/[’']/g," ")
        .replace(/\s+/g," ")
        .trim();
}

function normalizzaDistanzaIndoorAperto(distanzaValore,nomeGara="",tipoGaraValore=""){
    const d = String(distanzaValore || "").trim();

    if(d === "25+18" || d === "18+25") return "18+25";
    if(d === "25") return "25";
    if(d === "18") return "18";

    const testo = normalizzaTestoGara(`${nomeGara || ""} ${tipoGaraValore || ""}`);

    if(testo.includes("25+18") || testo.includes("18+25") || testo.includes("25 + 18") || testo.includes("18 + 25")){
        return "18+25";
    }

    if(/\b25\s*m\b/.test(testo) || /\b25m\b/.test(testo) || /\b25\s*metri\b/.test(testo)){
        return "25";
    }

    if(/\b18\s*m\b/.test(testo) || /\b18m\b/.test(testo) || /\b18\s*metri\b/.test(testo)){
        return "18";
    }

    return "";
}

function normalizzaTipoGaraFrontend(tipo,distanzaValore,dati={}){

    const raw = String(tipo || "").trim();

    if(raw === "Indoor 18m" || raw === "Indoor 25m" || raw === "Indoor 18+25"){
        return raw;
    }

    if(raw === "Indoor all'aperto 😉"){
        return "Indoor all'aperto 😉";
    }

    if(Boolean(dati.all_aperto)){
        return "Indoor all'aperto 😉";
    }

    const testo = normalizzaTestoGara(`${raw} ${dati.nome || ""}`);

    if(testo.includes("all aperto") || testo.includes("aperto")){
        return "Indoor all'aperto 😉";
    }

    if(raw && archi[raw]){
        return raw;
    }

    return raw || "Targa";
}

function tipoScoreDaScelta(){

    const tipo = tipoGara.value;
    const d = distanza ? String(distanza.value || "") : "";

    if(tipo === "Indoor all'aperto 😉"){
        if(d === "18") return "Indoor 18m";
        if(d === "25") return "Indoor 25m";
        if(d === "18+25" || d === "25+18") return "Indoor 18+25";
        return "Indoor 18m";
    }

    return tipo;
}

function isIndoorAllAperto(tipo){
    return tipo === "Indoor all'aperto 😉";
}

function isTargaOutdoor(tipo){
    return tipo === "Targa 18m" || tipo === "Targa 25m" || tipo === "Targa 18+25m";
}

function distanzaSalvataggio(tipo){
    if(tipo === "Indoor all'aperto 😉"){
        return distanza ? distanza.value : null;
    }

    return distanceContainer.style.display === "none" ? null : distanza.value;
}

function slug(text){
    return String(text || "")
        .toLowerCase()
        .replaceAll("/","")
        .replaceAll("&","")
        .replaceAll("+","")
        .replaceAll(" ","-");
}