const tipoAllenamento = document.getElementById("tipo_allenamento");
const tipoArco = document.getElementById("tipo_arco");
const distanza = document.getElementById("distanza");
const piazzole = document.getElementById("piazzole");
const distanceContainer = document.getElementById("distanceContainer");
const piazzoleContainer = document.getElementById("piazzoleContainer");
const scoreContainer = document.getElementById("scoreContainer");
const keyboardLegend = document.getElementById("keyboardLegend");
const generaScoreBtn = document.getElementById("generaScore");
const banner = document.getElementById("allenamentoTypeBanner");
const pageTitle = document.getElementById("pageTitle");

const params = new URLSearchParams(window.location.search);
const editId = params.get("edit");

let modalitaModifica = Boolean(editId);

const archiPerAllenamento = {
    "Indoor":["Olimpico","Compound","Arco Nudo","Longbow","Istintivo"],
    "Targa":["Olimpico","Compound","Arco Nudo","Longbow","Istintivo"],
    "Campagna/H&F":["Compound","Arco Nudo","Longbow","Istintivo"],
    "3D":["Compound","Arco Nudo","Longbow","Istintivo"]
};

tipoAllenamento?.addEventListener("change", () => { aggiornaArchi(); aggiornaCampi(); });
tipoArco?.addEventListener("change", aggiornaDistanze);
generaScoreBtn?.addEventListener("click", generaScore);

inizializzaAllenamento();

function inizializzaAllenamento(){
    const oggi = new Date().toISOString().slice(0,10);
    document.getElementById("data").value = oggi;

    aggiornaArchi();

    for(let i = 1; i <= 24; i++){
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = i + " piazzole";
        piazzole.appendChild(opt);
    }

    aggiornaCampi();

    if(editId){
        caricaAllenamentoDaModificare(editId);
    }
}


function aggiornaArchi(){
    if(!tipoArco || !tipoAllenamento){
        return;
    }

    const tipo = tipoAllenamento.value || "Indoor";
    const corrente = tipoArco.value;
    const archi = archiPerAllenamento[tipo] || archiPerAllenamento["Indoor"];

    tipoArco.innerHTML = "";

    archi.forEach(arco => {
        const opt = document.createElement("option");
        opt.value = arco;
        opt.textContent = arco;
        tipoArco.appendChild(opt);
    });

    if(archi.includes(corrente)){
        tipoArco.value = corrente;
    }else{
        tipoArco.value = archi[0] || "";
    }
}

function aggiornaCampi(){
    aggiornaDistanze();
    aggiornaBanner();
}

function aggiornaDistanze(){
    const tipo = tipoAllenamento.value;
    const arco = tipoArco.value;

    distanza.innerHTML = "";

    if(tipo === "Campagna/H&F" || tipo === "3D"){
        distanceContainer.classList.add("hidden");
        piazzoleContainer.classList.remove("hidden");
        return;
    }

    piazzoleContainer.classList.add("hidden");
    distanceContainer.classList.remove("hidden");

    let distanze = [];

    if(tipo === "Indoor"){
        distanze = ["18","25"];
    }else if(tipo === "Targa"){
        distanze = arco === "Olimpico"
            ? ["18","20","25","30","35","40","45","50","55","60","65","70"]
            : ["18","20","25","30","35","40","45","50"];
    }

    distanze.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d + " m";
        distanza.appendChild(opt);
    });
}

function aggiornaBanner(){
    if(!banner) return;

    const tipo = tipoAllenamento.value || "Allenamento";
    let testo = tipo;

    if(tipo === "Indoor"){
        testo = `Indoor ${distanza.value || ""} metri`;
    }

    if(tipo === "Targa"){
        testo = `Targa ${distanza.value || ""} metri`;
    }

    if(tipo === "Campagna/H&F"){
        testo = `Campagna/H&F - ${piazzole.value || 1} piazzole`;
    }

    if(tipo === "3D"){
        testo = `3D - ${piazzole.value || 1} piazzole`;
    }

    banner.textContent = testo;
}

distanza?.addEventListener("change", aggiornaBanner);
piazzole?.addEventListener("change", aggiornaBanner);

function tipoScoreDaScelta(){
    const tipo = tipoAllenamento.value;
    const d = distanza.value;

    if(tipo === "Indoor"){
        return d === "25" ? "Indoor 25m" : "Indoor 18m";
    }

    if(tipo === "Targa"){
        if(d === "18") return "Targa 18m";
        if(d === "25") return "Targa 25m";
        return "Targa";
    }

    if(tipo === "Campagna/H&F"){
        return "Allenamento H&F";
    }

    if(tipo === "3D"){
        return "Allenamento 3D";
    }

    return "";
}

function creaRuleAllenamento(){
    const tipoScore = tipoScoreDaScelta();

    if(tipoScore === "Allenamento H&F"){
        return {
            targets:Number(piazzole.value || 1),
            arrowsPerTarget:3,
            allowed:["M","1","2","3","4","5","6"]
        };
    }

    if(tipoScore === "Allenamento 3D"){
        return {
            targets:Number(piazzole.value || 1),
            arrowsPerTarget:2,
            allowed:["M","5","8","10","11"],
            shortcuts:{ "+":"10", "*":"11" }
        };
    }

    const baseRule = RULES[tipoScore] || RULES["Targa"];

    return JSON.parse(JSON.stringify(baseRule));
}

function generaScore(){
    const tipo = tipoAllenamento.value;

    if(!tipo){
        mostraPopup("Seleziona un tipo allenamento", "error");
        return;
    }

    const tipoScore = tipoScoreDaScelta();
    const rule = creaRuleAllenamento();

    if(!rule){
        mostraPopup("Regole allenamento non trovate", "error");
        return;
    }

    scoreContainer.innerHTML = "";
    keyboardLegend.innerHTML = "";

    aggiornaBanner();
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
                <div class="volley-row score-row" data-serie="${s}" data-volley="${v}" style="grid-template-columns:${columns};">
                    <span>V${v}</span>
            `;

            for(let a = 1; a <= rule.arrowsPerVolley; a++){
                html += `<input class="arrow-input" maxlength="2" data-serie="${s}" data-volley="${v}" data-arrow="${a}">`;
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
        </div>`;
    }

    html += `</div><div id="summaryContainer" class="summary-card"></div>`;
    scoreContainer.innerHTML = html;
}

function generaPercorso(tipo, rule){
    const labels = getSpecialLabels(tipo);

    const columns = tipo.includes("H&F")
        ? `90px repeat(3, minmax(34px, 1fr)) 52px 58px 52px 52px`
        : `90px repeat(2, minmax(34px, 1fr)) 52px 58px 58px 58px`;

    const totalePiazzole = Number(rule.targets || 1);
    const primaSerie = Math.ceil(totalePiazzole / 2);

    let html = `<div class="score-grid">`;

    for(let serie = 1; serie <= 2; serie++){
        const start = serie === 1 ? 1 : primaSerie + 1;
        const end = serie === 1 ? primaSerie : totalePiazzole;

        if(start > totalePiazzole){
            continue;
        }

        html += `
            <div class="score-card">
                <h2>Serie ${serie} - Piazzole ${start}-${end}</h2>
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
                <div class="volley-row score-row" data-serie="${serie}" data-volley="${p}" data-target="${p}" style="grid-template-columns:${columns};">
                    <span>P${p}</span>
            `;

            for(let a = 1; a <= rule.arrowsPerTarget; a++){
                html += `<input class="arrow-input" maxlength="2" data-serie="${serie}" data-volley="${p}" data-target="${p}" data-arrow="${a}">`;
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
            <div class="series-summary" data-serie-summary="${serie}">
                <span>Totale serie: <strong class="serie-total">0</strong></span>
                <span>${labels[0]}: <strong class="serie-special-a">0</strong></span>
                <span>${labels[1]}: <strong class="serie-special-b">0</strong></span>
            </div>
        </div>`;
    }

    html += `</div><div id="summaryContainer" class="summary-card"></div>`;
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
        <h2>Riepilogo Allenamento</h2>
        <div class="summary-grid">
            <div class="summary-item"><div class="summary-value">${totale}</div><div>Punteggio</div></div>
            <div class="summary-item"><div class="summary-value">${specialA}</div><div>${labels[0]}</div></div>
            <div class="summary-item"><div class="summary-value">${specialB}</div><div>${labels[1]}</div></div>
            <div class="summary-item"><div class="summary-value">${mediaFreccia}</div><div>Media freccia</div></div>
            <div class="summary-item"><div class="summary-value">${mediaVolee}</div><div>Media volée</div></div>
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
    if(tipo.includes("Targa")){
        return { a: value === "X" || value === "10" ? 1 : 0, b: value === "X" ? 1 : 0 };
    }

    if(tipo.includes("Indoor")){
        return { a: value === "10" ? 1 : 0, b: value === "9" ? 1 : 0 };
    }

    if(tipo.includes("3D")){
        return { a: value === "11" ? 1 : 0, b: value === "10" ? 1 : 0 };
    }

    if(tipo.includes("H&F")){
        return { a: value === "6" ? 1 : 0, b: value === "5" ? 1 : 0 };
    }

    return { a:0, b:0 };
}

function getSpecialLabels(tipo){
    if(tipo.includes("Targa")) return ["X+10","X"];
    if(tipo.includes("Indoor")) return ["10","9"];
    if(tipo.includes("3D")) return ["11","10"];
    if(tipo.includes("H&F")) return ["6","5"];
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

    if(tipo.includes("H&F")){
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

    const isPercorso =
        tipoAllenamento.value === "3D" ||
        tipoAllenamento.value === "Campagna/H&F";

    const totalePiazzole =
        Number(piazzole?.value || 1);

    const primaSerie =
        Math.ceil(totalePiazzole / 2);

    inputs.forEach(input => {
        const target =
            Number(input.dataset.target || input.dataset.volley || 1);

        const seriePercorso =
            target <= primaSerie ? 1 : 2;

        score.push({
            serie: isPercorso ? seriePercorso : Number(input.dataset.serie || 1),
            volee: isPercorso ? target : Number(input.dataset.volley || 1),
            freccia: Number(input.dataset.arrow || 1),
            valore: input.value.trim().toUpperCase()
        });
    });

    return score;
}

function aggiungiPulsanteSalva(){
    if(document.getElementById("salvaAllenamento")){
        return;
    }

    const btn = document.createElement("button");

    btn.type = "button";
    btn.id = "salvaAllenamento";
    btn.className = "generate-btn save-btn";
    btn.textContent = modalitaModifica ? "Salva Modifiche" : "Salva Allenamento";

    btn.addEventListener("click", salvaAllenamento);

    scoreContainer.appendChild(btn);
}

async function salvaAllenamento(){
    const tipoScore = tipoScoreDaScelta();
    const summary = document.getElementById("summaryContainer");

    if(!summary){
        mostraPopup("Genera prima lo score", "error");
        return;
    }

    const totale = Number(summary.dataset.totale || 0);
    const specialA = Number(summary.dataset.specialA || 0);
    const specialB = Number(summary.dataset.specialB || 0);

    const tipo = tipoAllenamento.value;

    const allenamento = {
        data: document.getElementById("data").value,
        tipo_arco: tipoArco.value,
        tipo_allenamento: tipo,
        distanza: tipo === "Campagna/H&F" || tipo === "3D" ? null : distanza.value,
        piazzole: tipo === "Campagna/H&F" || tipo === "3D" ? Number(piazzole.value || 1) : null,
        punteggio: totale,
        x_count: tipoScore.includes("Targa") ? specialB : 0,
        ten_count: tipoScore.includes("3D") ? specialB : (tipoScore.includes("Targa") || tipoScore.includes("Indoor")) ? specialA : 0,
        eleven_count: tipoScore.includes("3D") ? specialA : 0,
        nine_count: tipoScore.includes("Indoor") ? specialB : 0,
        six_count: tipoScore.includes("H&F") ? specialA : 0,
        five_count: tipoScore.includes("H&F") ? specialB : 0,
        miss_count: 0,
        score: creaDatiScore()
    };

    try{
        const url = modalitaModifica ? `/api/allenamenti/${editId}` : "/api/allenamenti";
        const method = modalitaModifica ? "PUT" : "POST";

        const res = await fetch(url, {
            method,
            headers:{ "Content-Type":"application/json" },
            body:JSON.stringify(allenamento)
        });

        const result = await res.json();

        if(!result.success){
            mostraPopup("Errore salvataggio", "error");
            return;
        }

        mostraPopup(modalitaModifica ? "Allenamento modificato" : "Allenamento salvato", "success");

        setTimeout(() => {
            window.location.href = "/home.html";
        }, 1200);

    }catch(err){
        console.error(err);
        mostraPopup("Errore salvataggio allenamento", "error");
    }
}

async function caricaAllenamentoDaModificare(id){
    try{
        const res = await fetch(`/api/allenamenti/${id}`);
        const a = await res.json();

        if(!a || a.success === false){
            mostraPopup("Allenamento non trovato", "error");
            return;
        }

        modalitaModifica = true;
        if(pageTitle) pageTitle.textContent = "Modifica Allenamento";

        document.getElementById("data").value = a.data || "";
        tipoAllenamento.value = a.tipo_allenamento || "Indoor";
        aggiornaArchi();
        tipoArco.value = a.tipo_arco || tipoArco.value;

        aggiornaCampi();

        if(a.distanza) distanza.value = a.distanza;
        if(a.piazzole) piazzole.value = a.piazzole;

        generaScore();

        setTimeout(() => {
            riempiScoreSalvato(a.score || []);
            aggiornaScore(tipoScoreDaScelta(), creaRuleAllenamento());
        }, 100);

    }catch(err){
        console.error(err);
        mostraPopup("Errore caricamento modifica", "error");
    }
}

function riempiScoreSalvato(score){
    score.forEach(r => {
        const isPercorso = tipoAllenamento.value.includes("3D") || tipoAllenamento.value.includes("Campagna");

        const selector = isPercorso
            ? `.arrow-input[data-serie="${r.serie}"][data-volley="${r.volee}"][data-arrow="${r.freccia}"]`
            : `.arrow-input[data-serie="${r.serie}"][data-volley="${r.volee}"][data-arrow="${r.freccia}"]`;

        const input = document.querySelector(selector);

        if(input){
            input.value = r.valore;
            applicaColore(input, r.valore, tipoScoreDaScelta());
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


// Fix caricamento modifica: ricalcola progressivi dopo il riempimento dei valori
if(new URLSearchParams(window.location.search).get("edit")){
    setTimeout(() => {
        try{
            if(typeof aggiornaScore === "function"){
                const tipo = tipoScoreDaScelta ? tipoScoreDaScelta() : "";
                const rule = creaRuleAllenamento ? creaRuleAllenamento() : null;
                if(tipo && rule) aggiornaScore(tipo, rule);
            }
        }catch(e){
            console.warn("Ricalcolo progressivi non riuscito", e);
        }
    }, 900);
}
