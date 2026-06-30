caricaDashboard();

async function caricaDashboard(){
    try{
        const res = await fetch("/api/dashboard");
        const d = await res.json();

        setText("dashUltimaGara", d.ultima_gara ? d.ultima_gara.punteggio : "-");
        setText("dashUltimaGaraData", d.ultima_gara ? formatDate(d.ultima_gara.data) : "-");

        setText("dashUltimoAllenamento", d.ultimo_allenamento ? d.ultimo_allenamento.punteggio : "-");
        setText("dashUltimoAllenamentoData", d.ultimo_allenamento ? formatDate(d.ultimo_allenamento.data) : "-");

        setText("dashMedia30", d.media_30 || 0);
        setText("dashAllenamentiMese", d.allenamenti_mese || 0);
        setText("dashGareMese", d.gare_mese || 0);
        setText("dashFrecceAnno", d.frecce_anno || 0);
    }catch(err){
        console.error("Dashboard:", err);
    }
}

function setText(id,value){
    const el = document.getElementById(id);
    if(el) el.textContent = value;
}

function formatDate(date){
    if(!date) return "-";
    const p = String(date).split("-");
    if(p.length !== 3) return date;
    return `${p[2]}/${p[1]}/${p[0]}`;
}
