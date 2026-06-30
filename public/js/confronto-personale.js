function confrontoClass(diff){
    return Number(diff || 0) >= 0 ? "compare-good" : "compare-bad";
}

function formatDiff(diff){
    const n = Number(diff || 0);
    return `${n >= 0 ? "+" : ""}${n}`;
}

function renderConfrontoPersonale(c){
    if(!c){
        return "";
    }

    if(!c.risultati_precedenti){
        return `
            <div class="personal-compare-card">
                <h3>📈 Confronto personale</h3>
                <p>Primo risultato salvato per questa categoria.</p>
                <div class="compare-message">🥇 Primo riferimento personale</div>
            </div>
        `;
    }

    return `
        <div class="personal-compare-card">
            <h3>📈 Confronto personale</h3>
            <p class="compare-category">${c.categoria?.label || ""}</p>

            <div class="compare-grid">
                <div>
                    <span>Risultato</span>
                    <strong>${c.punteggio}</strong>
                </div>

                <div>
                    <span>Media generale</span>
                    <strong>${c.media_generale}</strong>
                    <small class="${confrontoClass(c.differenza_media)}">${formatDiff(c.differenza_media)}</small>
                </div>

                <div>
                    <span>Media ultimi 5</span>
                    <strong>${c.media_ultimi_5}</strong>
                    <small class="${confrontoClass(c.differenza_ultimi_5)}">${formatDiff(c.differenza_ultimi_5)}</small>
                </div>

                <div>
                    <span>Posizione personale</span>
                    <strong>${c.posizione}°</strong>
                    <small>su ${c.totale_risultati}</small>
                </div>
            </div>

            <div class="compare-message">${c.messaggio}</div>
        </div>
    `;
}

async function caricaConfronto(kind,id){
    try{
        const res = await fetch(`/api/confronto/${kind}/${id}`);
        const json = await res.json();

        if(!json.success){
            return null;
        }

        return json.confronto;
    }catch(err){
        console.error("Confronto:",err);
        return null;
    }
}
