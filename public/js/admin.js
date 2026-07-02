async function api(url,options={}){
    const r=await fetch(url,{
        headers:{ "Content-Type":"application/json" },
        ...options
    });

    const j=await r.json().catch(()=>({}));

    if(!r.ok){
        throw new Error(j.message || "Errore");
    }

    return j;
}

function esc(s){
    return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
}

async function loadAdmin(){
    try{
        const me=await api("/api/auth/me");
        if(!me.user || me.user.role!=="admin"){
            location.href="/home.html";
            return;
        }

        const summary=await api("/api/admin/summary");
        renderStats(summary);

        const users=await api("/api/admin/users");
        renderUsers(users.users || []);
    }catch(err){
        alert(err.message || "Accesso admin non disponibile");
        location.href="/home.html";
    }
}

function renderStats(s){
    document.getElementById("adminStats").innerHTML=[
        ["Utenti",s.utenti],
        ["Verificati",s.verificati],
        ["Bloccati",s.bloccati],
        ["Gare",s.gare],
        ["Allenamenti",s.allenamenti]
    ].map(([label,value])=>`
        <div class="admin-stat">
            <strong>${esc(value)}</strong>
            <span>${esc(label)}</span>
        </div>
    `).join("");
}

function renderUsers(users){
    document.getElementById("adminUsers").innerHTML=users.map(u=>`
        <tr>
            <td><strong>${esc(u.username)}</strong><br><small>ID ${esc(u.id)}</small></td>
            <td>${esc(u.email)}</td>
            <td><span class="admin-badge">${esc(u.role || "user")}</span></td>
            <td>${Number(u.email_verified||0)===1?'<span class="admin-badge ok">Sì</span>':'<span class="admin-badge no">No</span>'}</td>
            <td>${Number(u.blocked||0)===1?'<span class="admin-badge no">Bloccato</span>':'<span class="admin-badge ok">Attivo</span>'}</td>
            <td>${esc(u.gare_count || 0)}</td>
            <td>${esc(u.allenamenti_count || 0)}</td>
            <td>${esc(u.last_login || "-")}</td>
            <td>
                <div class="admin-actions">
                    <button class="admin-action small blue" onclick="viewUser(${u.id})">Vedi</button>
                    ${Number(u.email_verified||0)!==1?`<button class="admin-action small green" onclick="verifyUser(${u.id})">Verifica</button>`:""}
                    ${Number(u.blocked||0)===1?`<button class="admin-action small green" onclick="unblockUser(${u.id})">Sblocca</button>`:`<button class="admin-action small gray" onclick="blockUser(${u.id})">Blocca</button>`}
                    <button class="admin-action small blue" onclick="setRole(${u.id},'${u.role==='admin'?'user':'admin'}')">${u.role==='admin'?'Utente':'Admin'}</button>
                    <button class="admin-action small red" onclick="deleteUser(${u.id},'${esc(u.username)}')">Elimina</button>
                </div>
            </td>
        </tr>
    `).join("");
}

async function viewUser(id){
    const data=await api(`/api/admin/users/${id}/data`);
    const box=document.getElementById("adminUserDetail");
    box.classList.remove("hidden-auth-box");

    box.innerHTML=`
        <h2>${esc(data.user.username)}</h2>
        <p><strong>Email:</strong> ${esc(data.user.email)} · <strong>Ruolo:</strong> ${esc(data.user.role)}</p>
        <div class="admin-detail-grid">
            <div>
                <h3>Gare (${data.gare.length})</h3>
                ${data.gare.slice(0,30).map(g=>`
                    <div class="admin-list-item">
                        <span>${esc(g.data)} · ${esc(g.nome || g.tipo_gara)}</span>
                        <strong>${esc(g.punteggio)}</strong>
                    </div>
                `).join("") || "<p>Nessuna gara</p>"}
            </div>
            <div>
                <h3>Allenamenti (${data.allenamenti.length})</h3>
                ${data.allenamenti.slice(0,30).map(a=>`
                    <div class="admin-list-item">
                        <span>${esc(a.data)} · ${esc(a.tipo_allenamento)}</span>
                        <strong>${esc(a.punteggio)}</strong>
                    </div>
                `).join("") || "<p>Nessun allenamento</p>"}
            </div>
        </div>
    `;
}

async function verifyUser(id){ await api(`/api/admin/users/${id}/verify`,{method:"POST"}); loadAdmin(); }
async function blockUser(id){ await api(`/api/admin/users/${id}/block`,{method:"POST"}); loadAdmin(); }
async function unblockUser(id){ await api(`/api/admin/users/${id}/unblock`,{method:"POST"}); loadAdmin(); }
async function setRole(id,role){ await api(`/api/admin/users/${id}/role`,{method:"POST",body:JSON.stringify({role})}); loadAdmin(); }

async function deleteUser(id,name){
    if(!confirm(`Eliminare definitivamente ${name}? Verranno cancellate anche gare e allenamenti.`)) return;
    await api(`/api/admin/users/${id}`,{method:"DELETE"});
    loadAdmin();
}

document.getElementById("refreshAdmin")?.addEventListener("click",loadAdmin);
loadAdmin();
