function titoloAllenamento(a){
    if(a.tipo_allenamento === "Campagna/H&F" || a.tipo_allenamento === "3D"){
        return `${a.tipo_allenamento} ${a.piazzole || ""} piazzole`;
    }

    return `${a.tipo_allenamento} ${a.distanza || ""}m`;
}

function formatDate(date){
    if(!date) return "";
    const [y,m,d] = String(date).split("-");
    return `${d}/${m}/${y}`;
}

function slugAllenamento(value){
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g,"-")
        .replace(/^-|-$/g,"");
}

function labelsAllenamento(a){
    const tipo = `${a.tipo_allenamento || ""}`;

    if(tipo.includes("Targa")) return ["X+10","X"];
    if(tipo.includes("Indoor")) return ["10","9"];
    if(tipo.includes("3D")) return ["11","10"];
    if(tipo.includes("H&F") || tipo.includes("Campagna")) return ["6","5"];

    return ["Max1","Max2"];
}

function scoreValueAllenamento(value){
    if(value === "M" || !value) return 0;
    if(value === "X") return 10;
    return Number(value) || 0;
}

function arrowClass(value){
    if(["X","11","10","9"].includes(value)) return "yellow-score";
    if(["8","7"].includes(value)) return "red-score";
    if(["6","5"].includes(value)) return "blue-score";
    if(["4","3","2","1"].includes(value)) return "black-score";
    if(value === "M") return "white-score";
    return "";
}

function calcolaTotaliSerie(score,allenamento=null){
    const serie = {};
    const isPercorso =
        allenamento &&
        (allenamento.tipo_allenamento === "3D" || allenamento.tipo_allenamento === "Campagna/H&F");

    const totalePiazzole =
        Number(allenamento?.piazzole || 0);

    const primaSerie =
        Math.ceil(totalePiazzole / 2);

    (score || []).forEach(r => {
        const volee = Number(r.volee || r.target || r.serie || 1);

        const s = isPercorso
            ? String(volee <= primaSerie ? 1 : 2)
            : String(r.serie || 1);

        if(!serie[s]){
            serie[s] = 0;
        }

        serie[s] += scoreValueAllenamento(String(r.valore || "").toUpperCase());
    });

    return serie;
}

async function apriScoreAllenamento(id){
    const res = await fetch(`/api/allenamenti/${id}`);
    const a = await res.json();

    if(!a || a.success === false){
        alert("Allenamento non trovato");
        return;
    }

    const modal = document.getElementById("scoreModal");
    const content = document.getElementById("scoreModalContent");
    const labels = labelsAllenamento(a);
    const serieTotals = calcolaTotaliSerie(a.score || [], a);

    const rows = raggruppaScore(a.score || [], a);
    const confronto = await caricaConfronto('allenamento', id);

    content.innerHTML = `
        <div class="modal-score-top">
            <div class="modal-race-info">
                <h2>${titoloAllenamento(a)}</h2>
                <p><strong>Data:</strong> ${formatDate(a.data)}</p>
                <p><strong>Arco:</strong> ${a.tipo_arco || ""}</p>
                ${a.distanza ? `<p><strong>Distanza:</strong> ${a.distanza}m</p>` : ""}
                ${a.piazzole ? `<p><strong>Piazzole:</strong> ${a.piazzole}</p>` : ""}
            </div>

            <div class="archive-highlight">
                ${Object.keys(serieTotals).map((s,i) => `
                    <div>
                        <span>Serie ${i+1}</span>
                        <strong>${serieTotals[s]}</strong>
                    </div>
                `).join("")}
                <div>
                    <span>Punteggio</span>
                    <strong>${a.punteggio || 0}</strong>
                </div>
                <div>
                    <span>${labels[0]}</span>
                    <strong>${specialA(a)}</strong>
                </div>
                <div>
                    <span>${labels[1]}</span>
                    <strong>${specialB(a)}</strong>
                </div>
            </div>
        </div>

        <div class="score-view-official">
            ${rows.map(row => renderScoreRow(row, a)).join("")}
        </div>

        ${renderConfrontoPersonale(confronto)}
    `;

    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function raggruppaScore(score,allenamento=null){
    const map = {};

    const isPercorso =
        allenamento &&
        (allenamento.tipo_allenamento === "3D" || allenamento.tipo_allenamento === "Campagna/H&F");

    const totalePiazzole =
        Number(allenamento?.piazzole || 0);

    const primaSerie =
        Math.ceil(totalePiazzole / 2);

    (score || []).forEach(r => {
        const volee = Number(r.volee || r.target || r.serie || 1);

        const serie = isPercorso
            ? (volee <= primaSerie ? 1 : 2)
            : (r.serie || 1);

        const key = `${serie}-${volee}`;

        if(!map[key]){
            map[key] = {
                serie:serie,
                volee:volee,
                arrows:[]
            };
        }

        map[key].arrows.push(r);
    });

    return Object.values(map).sort((a,b) => {
        if(Number(a.serie) !== Number(b.serie)) return Number(a.serie) - Number(b.serie);
        return Number(a.volee) - Number(b.volee);
    });
}

function renderScoreRow(row,a){
    const arrows = row.arrows.sort((x,y) => Number(x.freccia) - Number(y.freccia));
    const values = arrows.map(r => String(r.valore || "").toUpperCase());
    const tot = values.reduce((s,v) => s + scoreValueAllenamento(v),0);
    const labels = labelsAllenamento(a);

    const special = values.reduce((acc,v) => {
        const c = contaSpecialeRiga(a,v);
        acc.a += c.a;
        acc.b += c.b;
        return acc;
    },{a:0,b:0});

    const columns = `70px repeat(${arrows.length},42px) 52px 64px 64px`;

    return `
        <div class="archive-score-row" style="grid-template-columns:${columns};">
            <strong>S${row.serie}-V${row.volee}</strong>
            ${values.map(v => `<span class="archive-arrow ${arrowClass(v)}">${v || "-"}</span>`).join("")}
            <span class="archive-total">${tot}</span>
            <span class="archive-special">${labels[0]}: ${special.a}</span>
            <span class="archive-special">${labels[1]}: ${special.b}</span>
        </div>
    `;
}

function contaSpecialeRiga(a,value){
    const tipo = a.tipo_allenamento || "";

    if(tipo === "3D"){
        return { a:value === "11" ? 1 : 0, b:value === "10" ? 1 : 0 };
    }

    if(tipo === "Campagna/H&F"){
        return { a:value === "6" ? 1 : 0, b:value === "5" ? 1 : 0 };
    }

    if(tipo === "Indoor"){
        return { a:value === "10" ? 1 : 0, b:value === "9" ? 1 : 0 };
    }

    if(tipo === "Targa"){
        return { a:value === "X" || value === "10" ? 1 : 0, b:value === "X" ? 1 : 0 };
    }

    return { a:0, b:0 };
}

function specialA(a){
    if(a.tipo_allenamento === "3D") return a.eleven_count || 0;
    if(a.tipo_allenamento === "Campagna/H&F") return a.six_count || 0;
    if(a.tipo_allenamento === "Indoor") return a.ten_count || 0;
    return a.ten_count || 0;
}

function specialB(a){
    if(a.tipo_allenamento === "3D") return a.ten_count || 0;
    if(a.tipo_allenamento === "Campagna/H&F") return a.five_count || 0;
    if(a.tipo_allenamento === "Indoor") return a.nine_count || 0;
    return a.x_count || 0;
}

document.addEventListener("click", e => {
    if(e.target && e.target.id === "closeScoreModal"){
        document.getElementById("scoreModal")?.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }
});
