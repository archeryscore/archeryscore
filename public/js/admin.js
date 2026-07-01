async function checkAdmin(){
    const r = await fetch("/api/auth/me");
    if(!r.ok){ location.href="/login.html"; return false; }
    const data = await r.json();
    if(!data.user || !data.user.is_admin){
        alert("Accesso riservato all'amministratore");
        location.href="/home.html";
        return false;
    }
    return true;
}

function plurale(n,sing,plur){return Number(n)===1?sing:plur;}

async function caricaUtenti(){
    const r = await fetch("/api/admin/utenti");
    if(!r.ok){ alert("Non autorizzato"); return; }
    const data = await r.json();
    const utenti = data.utenti || [];

    const totaleGare = utenti.reduce((s,u)=>s+Number(u.gare_count||0),0);
    const totaleAllenamenti = utenti.reduce((s,u)=>s+Number(u.allenamenti_count||0),0);
    const verificati = utenti.filter(u=>Number(u.email_verified||0)===1).length;

    document.getElementById("adminSummary").innerHTML = `
        <div class="admin-kpi"><strong>${utenti.length}</strong><span>${plurale(utenti.length,"utente","utenti")}</span></div>
        <div class="admin-kpi"><strong>${totaleGare}</strong><span>${plurale(totaleGare,"gara","gare")}</span></div>
        <div class="admin-kpi"><strong>${totaleAllenamenti}</strong><span>${plurale(totaleAllenamenti,"allenamento","allenamenti")}</span></div>
        <div class="admin-kpi"><strong>${verificati}</strong><span>email verificate</span></div>
    `;

    document.getElementById("adminUsers").innerHTML = utenti.map(u=>`
        <div class="admin-user">
            <div><strong>${u.username}</strong><small>ID ${u.id}</small></div>
            <div>${u.email || "-"}<small>${Number(u.email_verified||0)===1?"Email verificata":"Email non verificata"}</small></div>
            <div><strong>${u.gare_count||0}</strong><small>gare</small></div>
            <div><strong>${u.allenamenti_count||0}</strong><small>allenamenti</small></div>
            <div><strong>${Number(u.is_admin||0)===1?"Admin":"Utente"}</strong><small>${Number(u.blocked||0)===1?"Bloccato":"Attivo"}</small></div>
            <div class="admin-actions">
                <button class="blue" onclick="vediUtente(${u.id})">Vedi</button>
                ${Number(u.blocked||0)===1
                    ? `<button class="green" onclick="sbloccaUtente(${u.id})">Sblocca</button>`
                    : `<button onclick="bloccaUtente(${u.id})">Blocca</button>`}
                ${Number(u.id)!==1 ? `<button class="danger" onclick="eliminaUtente(${u.id})">Elimina</button>` : ""}
            </div>
        </div>
    `).join("");
}

async function vediUtente(id){
    const r = await fetch(`/api/admin/utenti/${id}/dati`);
    const data = await r.json();
    if(!data.success){ alert(data.message || "Errore"); return; }

    document.getElementById("userDetailsCard").classList.remove("hidden");
    document.getElementById("detailsTitle").textContent = `Dettaglio ${data.user.username}`;

    document.getElementById("userDetails").innerHTML = `
        <div class="admin-detail-grid">
            <div class="admin-detail-list">
                <h3>Gare</h3>
                ${(data.gare||[]).map(g=>`<p><strong>${g.data||"-"}</strong> - ${g.nome||"Gara"} - ${g.punteggio||0}</p>`).join("") || "<p>Nessuna gara</p>"}
            </div>
            <div class="admin-detail-list">
                <h3>Allenamenti</h3>
                ${(data.allenamenti||[]).map(a=>`<p><strong>${a.data||"-"}</strong> - ${a.tipo_allenamento||"Allenamento"} - ${a.punteggio||0}</p>`).join("") || "<p>Nessun allenamento</p>"}
            </div>
        </div>
    `;
}

function chiudiDettaglio(){
    document.getElementById("userDetailsCard").classList.add("hidden");
}

async function bloccaUtente(id){
    if(!confirm("Bloccare questo utente?")) return;
    await fetch(`/api/admin/utenti/${id}/blocca`,{method:"POST"});
    caricaUtenti();
}

async function sbloccaUtente(id){
    await fetch(`/api/admin/utenti/${id}/sblocca`,{method:"POST"});
    caricaUtenti();
}

async function eliminaUtente(id){
    if(!confirm("Eliminare definitivamente utente e dati?")) return;
    await fetch(`/api/admin/utenti/${id}`,{method:"DELETE"});
    caricaUtenti();
}

(async()=>{ if(await checkAdmin()) caricaUtenti(); })();
