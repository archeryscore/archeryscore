function formattaMese(mese){const p=String(mese||"").split("-");if(p.length!==2)return mese||"";const m=["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];return `${m[parseInt(p[1],10)-1]||p[1]} ${p[0]}`;}

caricaStatistiche();

document.addEventListener("click", e => {
    const btn = e.target.closest(".stats-tab");
    if(!btn) return;

    document.querySelectorAll(".stats-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".stats-section").forEach(s => s.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add("active");
});

async function caricaStatistiche(){
    const anno = getSelectedYear();

    const [statsRes, progressRes, valoriRes, evoluzioneRes] = await Promise.all([
        fetch("/api/statistiche/complete"),
        fetch("/api/progressi"),
        fetch(`/api/statistiche/valori?anno=${encodeURIComponent(anno)}`),
        fetch(`/api/statistiche/evoluzione?anno=${encodeURIComponent(anno)}`)
    ]);

    const stats = await statsRes.json();
    ensureYearFilter([], caricaStatistiche);
    renderStatistiche(stats);

    renderProgressi(await progressRes.json());
    renderValori(await valoriRes.json());
    renderEvoluzione(await evoluzioneRes.json());
}

function renderStatistiche(rows){
    const year=getSelectedYear();
    const el=document.getElementById("statsContainer");
    if(!rows.length){el.innerHTML=`<div class="empty-state">Nessun dato disponibile</div>`;return;}
    const gare=rows.filter(r=>r.kind==="gara");
    const allenamenti=rows.filter(r=>r.kind==="allenamento");
    el.innerHTML=`
        <div class="record-card">
            <div class="record-header"><div><h2>Statistiche generali</h2><p>Medie e migliori risultati divisi tra gare e allenamenti.</p></div><div class="record-badge">${year==="all"?"Tutte":year}</div></div>
            ${renderStatTable("🏆 Gare",gare)}
            ${renderStatTable("🏹 Allenamenti",allenamenti)}
        </div>`;
}
function renderStatTable(title,rows){
    if(!rows.length)return `<div class="stat-split-block"><h3>${title}</h3><div class="trend-empty">Nessun dato disponibile</div></div>`;
    return `<div class="stat-split-block"><h3>${title}</h3><table class="stat-table"><thead><tr><th>Tipo</th><th>Sessioni</th><th>Media</th><th>Migliore</th><th>Peggiore</th><th>Frecce</th><th>Media/freccia</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.nome}</td><td>${r.count}</td><td>${r.media}</td><td>${r.migliore}</td><td>${r.peggiore}</td><td>${r.frecce}</td><td>${r.media_freccia}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderValori(data){
    const el = document.getElementById("valoriContainer");

    const gareGruppi = data.gare?.gruppi || [];
    const allenamentiGruppi = data.allenamenti?.gruppi || [];

    el.innerHTML = `
        <div class="record-card">
            <div class="record-header">
                <div>
                    <h2>Percentuale dei valori</h2>
                    <p>
                        Ogni tipologia resta separata: Targa 60m con Targa 60m,
                        Indoor 18m con Indoor 18m, 3D con 3D, allenamenti con allenamenti.
                    </p>
                </div>
                <div class="record-badge">${data.anno === "all" ? "Tutte" : data.anno}</div>
            </div>

            <div class="values-split-title">🏆 Gare</div>
            <div class="values-detail-grid">
                ${
                    gareGruppi.length
                        ? gareGruppi.map(g => renderGruppoValori(g)).join("")
                        : `<div class="trend-empty">Nessuna freccia gara disponibile</div>`
                }
            </div>

            <div class="values-split-title">🏹 Allenamenti</div>
            <div class="values-detail-grid">
                ${
                    allenamentiGruppi.length
                        ? allenamentiGruppi.map(g => renderGruppoValori(g)).join("")
                        : `<div class="trend-empty">Nessuna freccia allenamento disponibile</div>`
                }
            </div>
        </div>
    `;
}

function renderGruppoValori(g){
    return `
        <div class="value-group-card">
            <h3>${g.kind === "gare" ? "🏆" : "🏹"} ${g.label}</h3>
            <div class="value-total">${g.totale || 0} frecce</div>
            ${renderBarreValori(g.distribuzione, g.totale)}
        </div>
    `;
}

function renderDistribuzioneBox(title, blocco){
    return `
        <div class="value-box">
            <h3>${title}</h3>
            <div class="value-total">${blocco.totale || 0} frecce</div>
            ${renderBarreValori(blocco.distribuzione || [], blocco.totale || 0)}
        </div>
    `;
}

function renderBarreValori(items,total){
    if(!items.length){
        return `<div class="trend-empty">Nessun dato</div>`;
    }

    return items.map(v => `
        <div class="value-row">
            <div class="value-label">${v.valore}</div>
            <div class="value-bar">
                <span style="width:${v.percentuale}%"></span>
            </div>
            <div class="value-percent">${v.percentuale}%</div>
            <div class="value-count">${v.count}</div>
        </div>
    `).join("");
}

function renderEvoluzione(data){
    const el = document.getElementById("evoluzioneContainer");

    el.innerHTML = `
        <div class="record-card">
            <div class="record-header">
                <div>
                    <h2>Evoluzione mese per mese</h2>
                    <p>Medie mensili senza grafici complicati: solo numeri chiari.</p>
                </div>
                <div class="record-badge">${data.anno === "all" ? "Tutte" : data.anno}</div>
            </div>

            <div class="evolution-grid">
                ${renderEvoluzioneBox("Gare", data.gare)}
                ${renderEvoluzioneBox("Allenamenti", data.allenamenti)}
                ${renderEvoluzioneBox("Totale", data.totale)}
            </div>
        </div>
    `;
}

function renderEvoluzioneBox(title,rows){
    return `
        <div class="evolution-box">
            <h3>${title}</h3>
            ${
                rows.length
                    ? rows.map(r => `
                        <div class="evolution-row">
                            <strong>${formattaMese(r.mese)}</strong>
                            <span>${r.count} risultati</span>
                            <span>Media ${r.media}</span>
                            <span>Top ${r.migliore}</span>
                        </div>
                    `).join("")
                    : `<div class="trend-empty">Nessun dato</div>`
            }
        </div>
    `;
}

function renderProgressi(p){
    const el = document.getElementById("progressContainer");

    if(!p){
        el.innerHTML = `<div class="empty-state">Nessun dato disponibile</div>`;
        return;
    }

    el.innerHTML = `
        ${renderProgressiBlocco("🏆 Progressi Gare", p.gare)}
        ${renderProgressiBlocco("🏹 Progressi Allenamenti", p.allenamenti)}
    `;
}

function renderProgressiBlocco(titolo,p){
    if(!p || !p.eventi || p.eventi < 2){
        return `
            <div class="record-card">
                <h2>${titolo}</h2>
                <p>Servono almeno due risultati per calcolare l'andamento.</p>
            </div>
        `;
    }

    const andamento = p.differenza_media > 0 ? "stai migliorando" : p.differenza_media < 0 ? "sei in calo" : "sei stabile";

    const miglioramenti = (p.migliori_trend || [])
        .filter(t => Number(t.differenza || 0) > 0)
        .sort((a,b) => Number(b.differenza || 0) - Number(a.differenza || 0));

    const peggioramenti = (p.peggiori_trend || [])
        .filter(t => Number(t.differenza || 0) < 0)
        .sort((a,b) => Number(a.differenza || 0) - Number(b.differenza || 0));

    return `
        <div class="record-card">
            <div class="record-header">
                <div>
                    <h2>${titolo}</h2>
                    <p>
                        Il programma divide lo storico in due parti:
                        <strong>risultati vecchi</strong> e <strong>risultati recenti</strong>.
                    </p>
                </div>
                <div class="record-badge">${p.eventi} risultati</div>
            </div>

            <div class="record-grid">
                <div class="record-box"><span>Media risultati vecchi</span><strong>${p.media_prima}</strong><small>Prima metà</small></div>
                <div class="record-box"><span>Media risultati recenti</span><strong>${p.media_seconda}</strong><small>Seconda metà</small></div>
                <div class="record-box"><span>Andamento</span><strong class="${p.differenza_media >= 0 ? "progress-good" : "progress-bad"}">${p.differenza_media >= 0 ? "+" : ""}${p.differenza_media}</strong><small>${andamento}</small></div>
                <div class="record-box"><span>Media/freccia vecchia</span><strong>${p.ppf_prima}</strong><small>Qualità iniziale</small></div>
                <div class="record-box"><span>Media/freccia recente</span><strong>${p.ppf_seconda}</strong><small>Qualità attuale</small></div>
            </div>
        </div>

        <div class="record-card">
            <h2>${titolo} · Dove stai migliorando</h2>
            <div class="trend-list">
                ${miglioramenti.length ? miglioramenti.map(t => renderTrendCard(t,"good")).join("") : `<div class="trend-empty">Nessun miglioramento netto rilevato.</div>`}
            </div>
        </div>

        <div class="record-card">
            <h2>${titolo} · Da tenere sotto controllo</h2>
            <div class="trend-list">
                ${peggioramenti.length ? peggioramenti.map(t => renderTrendCard(t,"bad")).join("") : `<div class="trend-empty">Nessun peggioramento netto rilevato.</div>`}
            </div>
        </div>
    `;
}



function renderTrendCard(t,tipo){
    const diff = Number(t.differenza || 0);
    const isGood = tipo === "good";

    return `
        <div class="trend-card ${isGood ? "trend-good" : "trend-bad"}">
            <div class="trend-title">${isGood ? "🟢" : "🔴"} ${t.nome}</div>
            <div class="trend-values">
                <div><span>Primo risultato</span><strong>${t.primo}</strong></div>
                <div><span>Ultimo risultato</span><strong>${t.ultimo}</strong></div>
                <div><span>${isGood ? "Miglioramento" : "Differenza"}</span><strong>${diff > 0 ? "+" : ""}${diff} punti</strong></div>
            </div>
        </div>
    `;
}
