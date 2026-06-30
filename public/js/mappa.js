let map;
let markers = [];
let tutteLeGare = [];
let annoFiltro = "all";

inizializzaMappa();
collegaFiltriAnno();
caricaMarker();

function inizializzaMappa(){

    map = L.map("map").setView([42.5, 12.5], 6);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:19,
            attribution:"© OpenStreetMap"
        }
    ).addTo(map);

}

async function caricaMarker(){

    try{

        mostraPopup("Caricamento mappa...", "success");

        const res = await fetch("/api/mappa/gare");

        tutteLeGare = await res.json();
        ensureYearFilter(tutteLeGare, renderMappa);

        renderMappa();

        mostraPopup("Marker caricati", "success");

    }catch(err){

        console.error(err);
        mostraPopup("Errore caricamento mappa", "error");

    }

}

function renderMappa(){

    pulisciMarker();

    const annoSelezionato =
        typeof getSelectedYear === "function"
            ? getSelectedYear()
            : annoFiltro;

    const gareFiltrate =
    annoSelezionato === "all"
        ? tutteLeGare
        : tutteLeGare.filter(gara =>
            String(gara.data || "").startsWith(annoSelezionato)
        );

    const gruppi = raggruppaPerCoordinate(gareFiltrate);

    const bounds = [];

    gruppi.forEach(gruppo => {

        const marker = L.marker(
            [gruppo.lat, gruppo.lng],
            {
                icon:creaIconaMarker(gruppo.gare.length)
            }
        ).addTo(map);

        marker.bindPopup(creaPopupGruppo(gruppo));

        markers.push(marker);
        bounds.push([gruppo.lat, gruppo.lng]);

    });

    if(bounds.length > 0){

        map.fitBounds(bounds, { padding:[40,40] });

    }else{

        map.setView([42.5, 12.5], 6);

    }

}

function collegaFiltriAnno(){

    document
    .querySelectorAll(".map-filter")
    .forEach(btn => {

        btn.addEventListener("click", () => {

            document
            .querySelectorAll(".map-filter")
            .forEach(b => b.classList.remove("active"));

            btn.classList.add("active");

            annoFiltro = btn.dataset.year;
            if(typeof setSelectedYear === 'function') setSelectedYear(annoFiltro);

            renderMappa();

        });

    });

}

function raggruppaPerCoordinate(gare){

    const gruppi = {};

    gare.forEach(gara => {

        if(!gara.lat || !gara.lng){
            return;
        }

        const key =
        `${Number(gara.lat).toFixed(5)},${Number(gara.lng).toFixed(5)}`;

        if(!gruppi[key]){

            gruppi[key] = {
                lat:gara.lat,
                lng:gara.lng,
                luogo:gara.luogo,
                gare:[]
            };

        }

        gruppi[key].gare.push(gara);

    });

    return Object.values(gruppi);

}

function creaIconaMarker(numero){

    return L.divIcon({
        className:"custom-map-marker",
        html:`
            <div class="marker-pin-blue">
                <span>${numero}</span>
            </div>
        `,
        iconSize:[36,36],
        iconAnchor:[18,36],
        popupAnchor:[0,-36]
    });

}

function creaPopupGruppo(gruppo){

    const lista =
    gruppo.gare
    .map(gara => creaRigaGaraPopup(gara))
    .join("");

    return `
        <div class="marker-popup">

            <h3>📍 ${gruppo.luogo || "Località"}</h3>

            <p>
                ${gruppo.gare.length}
                ${gruppo.gare.length === 1 ? "gara" : "gare"}
                registrate
            </p>

            <div class="marker-race-list">
                ${lista}
            </div>

        </div>
    `;

}

function creaRigaGaraPopup(gara){

    const distanza =
    gara.distanza ? ` · ${gara.distanza}m` : "";

    return `
        <div class="marker-race">

            <strong>${gara.nome || "Gara"}</strong>

            <span>
                ${formatDate(gara.data)}
                ·
                ${formatTipoGara(gara.tipo_gara || "-")}
                ·
                ${gara.tipo_arco || "-"}${distanza}
            </span>

            <span>
                Punteggio:
                <b>${gara.punteggio || 0}</b>
            </span>

            <button onclick="vediGara(${gara.id})">
                Vedi
            </button>

        </div>
    `;

}

function pulisciMarker(){

    markers.forEach(marker => {
        map.removeLayer(marker);
    });

    markers = [];

}
async function vediGara(id){

    try{

        const res = await fetch("/api/gare/" + id);
        const gara = await res.json();
        const confronto = await caricaConfronto('gara', id);

        mostraScoreMappa(gara, confronto);

    }catch(err){

        console.error(err);
        mostraPopup("Errore apertura score", "error");

    }

}

function ensureScoreModalMappa(){
    if(document.getElementById("scoreModal")) return;

    const div = document.createElement("div");
    div.innerHTML = `
        <div id="scoreModal" class="modal hidden">
            <div class="modal-box">
                <div id="scoreModalContent"></div>
                <div class="modal-actions">
                    <button class="secondary-btn" onclick="chiudiScoreMappa()">Chiudi</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(div.firstElementChild);
}

function mostraScoreMappa(gara, confronto=null){

    ensureScoreModalMappa();
    const modal = document.getElementById("scoreModal");
    const content = document.getElementById("scoreModalContent");

    content.innerHTML = `
        <div class="modal-score-top">

            <div class="modal-race-info">
                <p><strong>Data:</strong> ${formatDate(gara.data)}</p>
                <p><strong>Luogo:</strong> ${gara.luogo || "-"}</p>
                <p><strong>Tipo:</strong> ${formatTipoGara(gara.tipo_gara || "-")}</p>
                <p><strong>Arco:</strong> ${gara.tipo_arco || "-"}</p>
                ${gara.distanza ? `<p><strong>Distanza:</strong> ${gara.distanza}m</p>` : ""}
            </div>

            ${creaHighlightMappa(gara)}

        </div>

        ${creaScoreMappa(gara)}

        ${renderConfrontoPersonale(confronto)}
    `;

    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");

}

function chiudiScoreMappa(){

    document
    .getElementById("scoreModal")
    .classList.add("hidden");

    document.body.classList.remove("modal-open");

}

function creaHighlightMappa(gara){

    const labels = getSpecialLabelsMappa(gara.tipo_gara);

    return `
        <div class="archive-highlight archive-highlight-card">

            ${creaSerieBoxesMappa(gara)}

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

function creaScoreMappa(gara){

    if(!gara.score || gara.score.length === 0){
        return `<div class="empty-archive">Score non disponibile</div>`;
    }

    const isPercorso =
    gara.tipo_gara.includes("3D") ||
    gara.tipo_gara.includes("Campagna");

    const freccePerRiga =
    isPercorso
        ? gara.tipo_gara.includes("Campagna") ? 3 : 2
        : isTargaOutdoorMappa(gara.tipo_gara) ? 3 : gara.tipo_gara.includes("Targa") ? 6 : 3;

    const labels = getSpecialLabelsMappa(gara.tipo_gara);
    const gruppi = {};

    gara.score.forEach(s => {

        const key =
        isPercorso
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

        const frecce =
        gruppi[key].sort((a,b) =>
            Number(a.freccia) - Number(b.freccia)
        );

        const serieKey =
        isPercorso ? "percorso" : key.split("-")[0];

        if(!progressivo[serieKey]){
            progressivo[serieKey] = 0;
        }

        let totale = 0;
        let specialA = 0;
        let specialB = 0;

        frecce.forEach(f => {

            totale += scoreValueMappa(f.valore);

            const sp =
            contaSpecialiMappa(gara.tipo_gara, f.valore);

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
                <span class="archive-arrow ${scoreColorClassMappa(gara.tipo_gara, valore)}">
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
function getSpecialLabelsMappa(tipo){
    if(isTargaOutdoorMappa(tipo)) return ["10","9"];
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

function scoreValueMappa(value){

    if(value === "M" || !value){
        return 0;
    }

    if(value === "X"){
        return 10;
    }

    return Number(value);

}

function contaSpecialiMappa(tipo,value){
    if(isTargaOutdoorMappa(tipo)){ return { a:value === "10" ? 1 : 0, b:value === "9" ? 1 : 0 }; }
    if(tipo.includes("Targa")){
        return {
            a:value === "X" || value === "10" ? 1 : 0,
            b:value === "X" ? 1 : 0
        };
    }

    if(tipo.includes("Indoor")){
        return {
            a:value === "10" ? 1 : 0,
            b:value === "9" ? 1 : 0
        };
    }

    if(tipo.includes("3D")){
        return {
            a:value === "11" ? 1 : 0,
            b:value === "10" ? 1 : 0
        };
    }

    if(tipo.includes("Campagna")){
        return {
            a:value === "6" ? 1 : 0,
            b:value === "5" ? 1 : 0
        };
    }

    return { a:0, b:0 };

}

function scoreColorClassMappa(tipo,value){

    if(!value){
        return "";
    }

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

    if(!date){
        return "-";
    }

    const d = new Date(date);

    return d.toLocaleDateString("it-IT");

}

function formatTipoGara(tipo){
    if(tipo === "Targa 18m") return "Targa all'aperto 18m";
    if(tipo === "Targa 25m") return "Targa all'aperto 25m";
    if(tipo === "Targa 18+25m") return "Targa all'aperto 18+25m";

    if(tipo === "3D 24") return "3D 24 piazzole";
    if(tipo === "3D 48") return "3D 48 piazzole";

    if(tipo === "Campagna/H&F 12+12"){
        return "Campagna/H&F 12+12 - 24 piazzole";
    }

    if(tipo === "Campagna/H&F 24+24"){
        return "Campagna/H&F 24+24 - 48 piazzole";
    }

    return tipo;

}

function mostraPopup(testo,tipo="success"){

    const popup = document.getElementById("popup");
    const popupText = document.getElementById("popupText");
    const popupIcon = document.getElementById("popupIcon");

    if(!popup || !popupText || !popupIcon){
        return;
    }

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
        popupIcon.textContent = "⚠️";

    }

    setTimeout(() => {
        popup.classList.add("hidden");
    },3000);

}

function isTargaOutdoorMappa(tipo){
    return tipo === "Targa 18m" || tipo === "Targa 25m" || tipo === "Targa 18+25m";
}

function creaSerieBoxesMappa(gara){
    const totali = calcolaTotaliSerieMappa(gara);
    return totali.map((totale,index) => `
            <div>
                <span>Serie ${index + 1}</span>
                <strong>${totale}</strong>
            </div>
    `).join("");
}

function calcolaTotaliSerieMappa(gara){
    if(!gara.score || gara.score.length === 0) return [];
    const isPercorso = gara.tipo_gara.includes("3D") || gara.tipo_gara.includes("Campagna");
    const totali = {};
    gara.score.forEach(s => {
        let serie;
        if(isPercorso){
            const p = Number(s.volee || s.serie || 0);
            serie = Math.ceil(p / 12);
        }else{
            serie = Number(s.serie || 1);
        }
        if(!totali[serie]) totali[serie] = 0;
        totali[serie] += scoreValueMappa(s.valore);
    });
    return Object.keys(totali).map(Number).sort((a,b) => a - b).map(k => totali[k]);
}


