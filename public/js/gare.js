const tipoGara = document.getElementById("tipo_gara");
const tipoArco = document.getElementById("tipo_arco");
const distanza = document.getElementById("distanza");
const distanceContainer = document.getElementById("distanceContainer");
const btnFitarco = document.getElementById("btnFitarco");
const tipoGaraContainer = document.getElementById("tipoGaraContainer");
const scoreContainer = document.getElementById("scoreContainer");
const keyboardLegend = document.getElementById("keyboardLegend");
const generaScoreBtn = document.getElementById("generaScore");

const archi = {
    "Indoor 18m": ["Olimpico", "Compound", "Arco Nudo", "Longbow"],
    "Indoor 25m": ["Olimpico", "Compound", "Arco Nudo", "Longbow"],
    "Indoor 18+25": ["Olimpico", "Compound", "Arco Nudo", "Longbow"],

    "Targa": ["Olimpico", "Compound", "Arco Nudo", "Longbow"],
    "Doppio Targa": ["Olimpico", "Compound", "Arco Nudo", "Longbow"],

    "Campagna/H&F 12+12": ["Olimpico", "Compound", "Arco Nudo", "Longbow"],
    "Campagna/H&F 24+24": ["Olimpico", "Compound", "Arco Nudo", "Longbow"],

    "3D 24": ["Compound", "Arco Nudo", "Longbow", "Istintivo"],
    "3D 48": ["Compound", "Arco Nudo", "Longbow", "Istintivo"]
};

tipoGara.addEventListener("change", aggiornaCampi);
tipoArco.addEventListener("change", aggiornaDistanze);
btnFitarco.addEventListener("click", caricaFitarco);
generaScoreBtn.addEventListener("click", generaScore);

aggiornaCampi();
if(editId){
    caricaGaraDaModificare(editId);
}

function aggiornaCampi(){

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

    distanza.innerHTML = "";

    const gara = tipoGara.value;
    const arco = tipoArco.value;

    if(
        gara.includes("Indoor") ||
        gara.includes("3D") ||
        gara.includes("Campagna")
    ){
        distanceContainer.style.display = "none";
        return;
    }

    distanceContainer.style.display = "flex";

    let distanze = [];

    if(arco === "Olimpico"){
        distanze = [18, 25, 30, 40, 60, 70];
    }else{
        distanze = [18, 25, 30, 40, 50];
    }

    distanze.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d + " m";
        distanza.appendChild(opt);
    });
}

async function caricaFitarco(){

    const codice = document
        .getElementById("codice_gara")
        .value
        .trim()
        .toUpperCase();

    if(!codice){
        mostraPopup("Inserisci un codice gara", "error");
        return;
    }

    try{

        const res = await fetch("/api/fitarco/" + codice);
        const dati = await res.json();

        if(!dati.success){
            mostraPopup("Gara non trovata: puoi inserirla manualmente", "error");
            mostraDettagliGara();
            document.getElementById("nome").value = "Gara " + codice;
            const dataInput = document.getElementById("data");
            if(dataInput && !dataInput.value) dataInput.value = new Date().toISOString().slice(0,10);
            if(tipoGara){
                if(tipoGaraContainer) tipoGaraContainer.style.display = "flex";
                tipoGara.value = tipoGara.value || "Targa";
                aggiornaCampi();
            }
            return;
        }

        document.getElementById("nome").value = dati.nome;
        document.getElementById("data").value = dati.data;
        document.getElementById("luogo").value = dati.luogo;

        tipoGara.value = dati.tipo_gara;
        aggiornaCampi();

        gestisciCampiDaFitarco(dati.tipo_gara);

        mostraPopup("Gara caricata da FITARCO", "success");

    }catch(err){
        console.error(err);
        mostraPopup("Errore caricamento gara", "error");
    }
}

function gestisciCampiDaFitarco(tipo){

    if(tipoGaraContainer){
        tipoGaraContainer.style.display = "none";
    }

    if(tipo === "Targa" || tipo === "Doppio Targa"){
        distanceContainer.style.display = "flex";
    }else{
        distanceContainer.style.display = "none";
    }
}

function mostraPopup(testo, tipo = "success"){

    const popup = document.getElementById("popup");
    const popupText = document.getElementById("popupText");
    const popupIcon = document.getElementById("popupIcon");

    popupText.textContent = testo;

    popup.classList.remove(
        "hidden",
        "popup-success",
        "popup-error"
    );

    if(tipo === "success"){
        popup.classList.add("popup-success");
        popupIcon.textContent = "✅";
    }else{
        popup.classList.add("popup-error");
        popupIcon.textContent = "❌";
    }

    setTimeout(() => {
        popup.classList.add("hidden");
    }, 3000);
}
function generaScore(){

    const tipo = tipoGara.value;

    if(!tipo){
        mostraPopup("Seleziona un tipo gara", "error");
        return;
    }

    const rule = RULES[tipo];

    if(!rule){
        mostraPopup("Regole gara non trovate", "error");
        return;
    }

    scoreContainer.innerHTML = "";
    keyboardLegend.innerHTML = "";

    generaLegenda(tipo, rule);

    if(rule.targets){
        generaPercorso(tipo, rule);
    }else{
        generaBersaglio(tipo, rule);
    }

    attivaScore(tipo, rule);
    aggiornaScore(tipo, rule);
}

function generaLegenda(tipo, rule){

    let html = `
        <div class="legend-title">
            Scorciatoie Tastiera
        </div>

        <div class="legend-row">
    `;

    if(rule.shortcuts){
        Object.keys(rule.shortcuts).forEach(key => {
            html += `
                <div class="legend-key">
                    ${key} → ${rule.shortcuts[key]}
                </div>
            `;
        });
    }

    if(tipo.includes("Targa")){
        html += `
            <div class="legend-key">X → X</div>
        `;
    }

    html += `
            <div class="legend-key">M → Miss</div>
            <div class="legend-key">Invio/valore valido → prossima casella</div>
        </div>
    `;

    keyboardLegend.innerHTML = html;
}

function generaBersaglio(tipo, rule){

    let html = `
        <div class="score-grid">
    `;

    for(let s = 1; s <= rule.series; s++){

        const labelDistanza =
            rule.distances && rule.distances[s - 1]
                ? ` - ${rule.distances[s - 1]}m`
                : "";

        html += `
            <div class="score-card">

                <h2>
                    Serie ${s}${labelDistanza}
                </h2>

                <div class="score-header"
                     style="grid-template-columns: 60px repeat(${rule.arrowsPerVolley}, 54px) 65px 65px 70px 70px;">

                    <div>Vol</div>
        `;

        for(let a = 1; a <= rule.arrowsPerVolley; a++){
            html += `<div>F${a}</div>`;
        }

        const labels = getSpecialLabels(tipo);

        html += `
                    <div>Tot</div>
                    <div>Prog</div>
                    <div>${labels[0]}</div>
                    <div>${labels[1]}</div>
                </div>
        `;

        for(let v = 1; v <= rule.volleysPerSeries; v++){

            html += `
                <div class="volley-row score-row"
                     data-serie="${s}"
                     data-volley="${v}"
                     style="grid-template-columns: 60px repeat(${rule.arrowsPerVolley}, 54px) 65px 65px 70px 70px;">

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
                    Totale serie: <strong class="serie-total">0</strong>
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

    let html = `
        <div class="score-grid one-column">

            <div class="score-card">

                <h2>${tipo}</h2>

                <div class="score-header"
                     style="grid-template-columns: 95px repeat(${rule.arrowsPerTarget}, 54px) 65px 65px 70px 70px;">

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

    for(let p = 1; p <= rule.targets; p++){

        html += `
            <div class="volley-row score-row"
                 data-target="${p}"
                 style="grid-template-columns: 95px repeat(${rule.arrowsPerTarget}, 54px) 65px 65px 70px 70px;">

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

    html += `
            </div>
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

            if(event.key === "Backspace" || event.key === "Delete"){
                return;
            }

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

    if(!value){
        input.className = "arrow-input";
        return;
    }

    if(rule.shortcuts && rule.shortcuts[value]){
        value = rule.shortcuts[value];
    }

    if(value === "X" && !tipo.includes("Targa")){
        input.value = "";
        return;
    }

    if(value === "M"){
        value = "M";
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
    let volleeCompilate = 0;
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
            volleeCompilate++;
        }

        row.querySelector(".volley-total").textContent = totaleRiga;
        row.querySelector(".special-a").textContent = specialA;
        row.querySelector(".special-b").textContent = specialB;

        const serie = row.dataset.serie || "percorso";

        if(!serieData[serie]){
            serieData[serie] = {
                total: 0,
                specialA: 0,
                specialB: 0
            };
        }

        serieData[serie].total += totaleRiga;
        serieData[serie].specialA += specialA;
        serieData[serie].specialB += specialB;

        row.querySelector(".volley-progressive").textContent =
            serieData[serie].total;
    });

    Object.keys(serieData).forEach(serie => {

        const summary =
            document.querySelector(
                `[data-serie-summary="${serie}"]`
            );

        if(summary){
            summary.querySelector(".serie-total").textContent =
                serieData[serie].total;

            summary.querySelector(".serie-special-a").textContent =
                serieData[serie].specialA;

            summary.querySelector(".serie-special-b").textContent =
                serieData[serie].specialB;
        }
    });

    aggiornaRiepilogoFinale(
        tipo,
        totaleGara,
        frecceCompilate,
        volleeCompilate,
        specialTotA,
        specialTotB
    );
}

function aggiornaRiepilogoFinale(
    tipo,
    totale,
    frecce,
    vollee,
    specialA,
    specialB
){

    const summary =
        document.getElementById("summaryContainer");
		summary.dataset.totale = totale;
		summary.dataset.specialA = specialA;
		summary.dataset.specialB = specialB;

    if(!summary){
        return;
		
    }

    const labels = getSpecialLabels(tipo);

    const mediaFreccia =
        frecce > 0
            ? (totale / frecce).toFixed(2)
            : "0.00";

    const mediaVolee =
        vollee > 0
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

    if(value === "M"){
        return 0;
    }

    if(value === "X"){
        return 10;
    }

    return Number(value);
}

function contaSpeciali(tipo, value){

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

    return {
        a: 0,
        b: 0
    };
}

function getSpecialLabels(tipo){

    if(tipo.includes("Targa")){
        return ["X+10", "X"];
    }

    if(tipo.includes("Indoor")){
        return ["10", "9"];
    }

    if(tipo.includes("3D")){
        return ["11", "10"];
    }

    if(tipo.includes("Campagna")){
        return ["6", "5"];
    }

    return ["Max 1", "Max 2"];
}

function applicaColore(input, value, tipo){

    input.className = "arrow-input";

    if(tipo.includes("3D")){

        if(value === "11"){
            input.classList.add("green-score");
        }

        else if(value === "10"){
            input.classList.add("yellow-score");
        }

        else if(value === "8"){
            input.classList.add("red-score");
        }

        else if(value === "5"){
            input.classList.add("blue-score");
        }

        else if(value === "M"){
            input.classList.add("white-score");
        }

        return;
    }

    if(tipo.includes("Campagna")){

        if(value === "6" || value === "5"){
            input.classList.add("yellow-score");
        }

        else if(["4", "3", "2", "1"].includes(value)){
            input.classList.add("black-score");
        }

        else if(value === "M"){
            input.classList.add("white-score");
        }

        return;
    }

    if(["X", "10", "9"].includes(value)){
        input.classList.add("yellow-score");
    }

    else if(["8", "7"].includes(value)){
        input.classList.add("red-score");
    }

    else if(["6", "5"].includes(value)){
        input.classList.add("blue-score");
    }

    else if(["4", "3"].includes(value)){
        input.classList.add("black-score");
    }

    else if(["2", "1", "M"].includes(value)){
        input.classList.add("white-score");
    }
}

function creaDatiScore(){

    const inputs =
        document.querySelectorAll(".arrow-input");

    const score = [];

    inputs.forEach(input => {
        score.push({
            serie:
                input.dataset.serie ||
                input.dataset.target ||
                1,
            volee:
                input.dataset.volley ||
                input.dataset.target ||
                1,
            freccia:
                input.dataset.arrow,
            valore:
                input.value.trim().toUpperCase()
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
    btn.className = "generate-btn";
    btn.textContent = "Salva Gara";

    btn.addEventListener("click", salvaGara);

    scoreContainer.appendChild(btn);
}

async function salvaGara(){

    const tipo = tipoGara.value;

    const summary =
        document.getElementById("summaryContainer");

    if(!summary){
        mostraPopup("Genera prima lo score", "error");
        return;
    }

    const totale =
        Number(
            summary.dataset.totale || 0
        );

    const specialA =
        Number(
            summary.dataset.specialA || 0
        );

    const specialB =
        Number(
            summary.dataset.specialB || 0
        );

    const score = creaDatiScore();

    const gara = {
        codice_gara:
            document
            .getElementById("codice_gara")
            .value
            .trim()
            .toUpperCase(),

        nome:
            document.getElementById("nome").value,

        data:
            document.getElementById("data").value,

        luogo:
            document.getElementById("luogo").value,

        lat:null,
        lng:null,

        tipo_gara: tipo,

        tipo_arco:
            tipoArco.value,

        distanza:
            distanceContainer.style.display === "none"
                ? null
                : distanza.value,

        punteggio: totale,

        x_count:
            tipo.includes("Targa")
                ? specialB
                : 0,

        ten_count:
            tipo.includes("3D")
                ? specialB
                : tipo.includes("Targa")
                    ? specialA
                    : tipo.includes("Indoor")
                        ? specialA
                        : 0,

        eleven_count:
            tipo.includes("3D")
                ? specialA
                : 0,

        miss_count: 0,

        score
    };

    try{
        const url = modalitaModifica
    ? `/api/gare/${editId}`
    : "/api/gare";

const method = modalitaModifica
    ? "PUT"
    : "POST";

const res = await fetch(url, {
    method: method,
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify(gara)
        });

        const result = await res.json();

        if(!result.success){
            mostraPopup("Errore salvataggio", "error");
            return;
        }

        mostraPopup(
    modalitaModifica
        ? "Gara modificata correttamente"
        : "Gara salvata correttamente",
    "success"
);

setTimeout(() => {

    window.location.href = "/";

}, 1500);

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
        garaInModifica = gara;

        document.querySelector(".page-header h1").textContent =
            "Modifica Gara";

        document.getElementById("codice_gara").value =
            gara.codice_gara || "";

        document.getElementById("nome").value =
            gara.nome || "";

        document.getElementById("data").value =
            gara.data || "";

        document.getElementById("luogo").value =
            gara.luogo || "";

        tipoGara.value = gara.tipo_gara || "";
        aggiornaCampi();

        tipoArco.value = gara.tipo_arco || "";

        aggiornaDistanze();

        if(gara.distanza){
            distanza.value = gara.distanza;
        }

        generaScore();

        setTimeout(() => {
            riempiScoreSalvato(gara.score || []);
            aggiornaScore(tipoGara.value, RULES[tipoGara.value]);
        }, 100);

        mostraPopup("Gara caricata in modifica", "success");

    }catch(err){
        console.error(err);
        mostraPopup("Errore caricamento modifica", "error");
    }
}

function riempiScoreSalvato(score){

    score.forEach(r => {

        let selector = "";

        const isPercorso =
            tipoGara.value.includes("3D") ||
            tipoGara.value.includes("Campagna");

        if(isPercorso){
            selector =
                `.arrow-input[data-target="${r.volee}"][data-arrow="${r.freccia}"]`;
        }else{
            selector =
                `.arrow-input[data-serie="${r.serie}"][data-volley="${r.volee}"][data-arrow="${r.freccia}"]`;
        }

        const input = document.querySelector(selector);

        if(input){
            input.value = r.valore;
            applicaColore(input, r.valore, tipoGara.value);
        }
    });
}