async function api(url,options={}){
    const r=await fetch(url,{headers:{ "Content-Type":"application/json" },...options});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.message || "Errore");
    return j;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
function formatDateIT(value){
    if(!value) return "-";
    const s=String(value);
    const m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if(!m) return s;
    return `${m[3]}/${m[2]}/${m[1]}${m[4]?` ${m[4]}:${m[5]}${m[6]?":"+m[6]:""}`:""}`;
}
function showAdminConfirm({title="Conferma",message="",confirmText="Conferma",danger=false,fields=""}){
    return new Promise(resolve=>{
        document.querySelector(".admin-modal-backdrop")?.remove();
        const wrap=document.createElement("div");
        wrap.className="admin-modal-backdrop";
        wrap.innerHTML=`<div class="admin-modal"><h3>${esc(title)}</h3><p>${esc(message)}</p>${fields}<div class="admin-modal-actions"><button class="admin-modal-cancel">Annulla</button><button class="admin-modal-confirm" style="${danger?"background:#ff5c7a;color:white":""}">${esc(confirmText)}</button></div></div>`;
        document.body.appendChild(wrap);
        wrap.querySelector(".admin-modal-cancel").onclick=()=>{wrap.remove();resolve(false);};
        wrap.querySelector(".admin-modal-confirm").onclick=()=>{const data={};wrap.querySelectorAll("input").forEach(i=>data[i.name]=i.value);wrap.remove();resolve(data.__hasFields?data:true);};
        if(fields) wrap.querySelector(".admin-modal-confirm").onclick=()=>{const data={__hasFields:true};wrap.querySelectorAll("input").forEach(i=>data[i.name]=i.value);wrap.remove();resolve(data);};
    });
}
async function loadAdmin(){
    try{
        const me=await api("/api/auth/me");
        if(!me.user || me.user.role!=="admin"){location.href="/home.html";return;}
        window.currentAdminId=Number(me.user.id);
        renderStats(await api("/api/admin/summary"));
        const users=await api("/api/admin/users");
        renderUsers(users.users||[]);
    }catch(err){alert(err.message||"Accesso admin non disponibile");location.href="/home.html";}
}
function renderStats(s){
    document.getElementById("adminStats").innerHTML=[["Utenti",s.utenti],["Verificati",s.verificati],["Bloccati",s.bloccati],["Gare",s.gare],["Allenamenti",s.allenamenti]].map(([label,value])=>`<div class="admin-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join("");
}
function renderUsers(users){
    document.getElementById("adminUsers").innerHTML=users.map(u=>{
        const isAdmin=(u.role||"user")==="admin";
        const adminProtected=Number(u.id)===1;
        return `<tr><td><strong>${esc(u.username)}</strong><br><small>ID ${esc(u.id)}</small></td><td>${esc(u.email)}</td><td><span class="admin-badge">${esc(u.role||"user")}</span></td><td>${Number(u.email_verified||0)===1?'<span class="admin-badge ok">Sì</span>':'<span class="admin-badge no">No</span>'}</td><td>${Number(u.blocked||0)===1?'<span class="admin-badge no">Bloccato</span>':'<span class="admin-badge ok">Attivo</span>'}</td><td>${esc(u.gare_count||0)}</td><td>${esc(u.allenamenti_count||0)}</td><td class="admin-date">${esc(formatDateIT(u.created_at))}</td><td class="admin-date">${esc(formatDateIT(u.last_login))}</td><td><div class="admin-actions"><button class="admin-action small blue" onclick="viewUser(${u.id})">Vedi</button>${Number(u.email_verified||0)!==1?`<button class="admin-action small green" onclick="verifyUser(${u.id},'${esc(u.username)}')">Verifica</button>`:""}${adminProtected?"":`<button class="admin-action small orange" onclick="sendReset(${u.id},'${esc(u.username)}')">Reset password</button>`}${adminProtected?'<span class="admin-badge ok">👑 Protetto</span>':`${Number(u.blocked||0)===1?`<button class="admin-action small green" onclick="unblockUser(${u.id},'${esc(u.username)}')">Sblocca</button>`:`<button class="admin-action small gray" onclick="blockUser(${u.id},'${esc(u.username)}')">Blocca</button>`}<button class="admin-action small orange" onclick="setRole(${u.id},'${u.role==='admin'?'user':'admin'}','${esc(u.username)}')">${u.role==='admin'?'Utente':'Admin'}</button><button class="admin-action small red" onclick="deleteUser(${u.id},'${esc(u.username)}')">Elimina</button>`}</div></td></tr>`;
    }).join("");
}
async function viewUser(id){
    const data=await api(`/api/admin/users/${id}/data`);
    const box=document.getElementById("adminUserDetail");
    box.classList.remove("hidden-auth-box");
    box.innerHTML=`<div class="admin-card-title"><div><h2>${esc(data.user.username)}</h2><p><strong>Email:</strong> ${esc(data.user.email)} · <strong>Ruolo:</strong> ${esc(data.user.role)} · <strong>Creato:</strong> ${esc(formatDateIT(data.user.created_at))}</p></div><button class="admin-action gray" onclick="closeUserDetail()">Chiudi</button></div><div class="admin-detail-grid"><div><h3>Gare (${data.gare.length})</h3>${data.gare.slice(0,30).map(g=>`<div class="admin-list-item"><span>${esc(formatDateIT(g.data))} · ${esc(g.nome||g.tipo_gara)}</span><strong>${esc(g.punteggio)}</strong></div>`).join("")||"<p>Nessuna gara</p>"}</div><div><h3>Allenamenti (${data.allenamenti.length})</h3>${data.allenamenti.slice(0,30).map(a=>`<div class="admin-list-item"><span>${esc(formatDateIT(a.data))} · ${esc(a.tipo_allenamento)}</span><strong>${esc(a.punteggio)}</strong></div>`).join("")||"<p>Nessun allenamento</p>"}</div></div>`;
    box.scrollIntoView({behavior:"smooth",block:"start"});
}
function closeUserDetail(){const box=document.getElementById("adminUserDetail");box.classList.add("hidden-auth-box");box.innerHTML="";}
async function verifyUser(id,name){if(!await showAdminConfirm({title:"Verificare utente?",message:`Confermare manualmente l'email di ${name}?`,confirmText:"Verifica"}))return;await api(`/api/admin/users/${id}/verify`,{method:"POST"});loadAdmin();}
async function sendReset(id,name){ if(Number(id)===1){ return await showAdminConfirm({title:"Admin originale",message:"Per l’admin originale usa Cambia password.",confirmText:"OK"}); }if(!await showAdminConfirm({title:"Inviare reset password?",message:`Inviare una mail di reset password a ${name}?`,confirmText:"Invia mail"}))return;await api(`/api/admin/users/${id}/reset-password`,{method:"POST"});await showAdminConfirm({title:"Reset inviato",message:"Reset email non attivo finché non configuriamo il dominio.",confirmText:"OK"});}
async function blockUser(id,name){if(!await showAdminConfirm({title:"Bloccare utente?",message:`Bloccare l'account di ${name}? Verrà disconnesso.`,confirmText:"Blocca",danger:true}))return;await api(`/api/admin/users/${id}/block`,{method:"POST"});loadAdmin();}
async function unblockUser(id,name){if(!await showAdminConfirm({title:"Sbloccare utente?",message:`Riattivare l'account di ${name}?`,confirmText:"Sblocca"}))return;await api(`/api/admin/users/${id}/unblock`,{method:"POST"});loadAdmin();}
async function setRole(id,role,name){const label=role==="admin"?"promuovere ad admin":"riportare a utente";if(!await showAdminConfirm({title:"Cambiare ruolo?",message:`Vuoi ${label} ${name}?`,confirmText:"Conferma"}))return;await api(`/api/admin/users/${id}/role`,{method:"POST",body:JSON.stringify({role})});loadAdmin();}
async function deleteUser(id,name){if(!await showAdminConfirm({title:"Eliminare utente?",message:`Eliminare definitivamente ${name}? Verranno cancellate anche gare e allenamenti.`,confirmText:"Elimina",danger:true}))return;await api(`/api/admin/users/${id}`,{method:"DELETE"});closeUserDetail();loadAdmin();}
async function changeAdminPassword(){
    const fields=`<input name="currentPassword" type="password" placeholder="Password attuale"><input name="newPassword" type="password" placeholder="Nuova password"><input name="confirmPassword" type="password" placeholder="Conferma nuova password">`;
    const data=await showAdminConfirm({title:"Cambia password admin",message:"Inserisci la password attuale e quella nuova.",confirmText:"Salva",fields});
    if(!data) return;
    if(!data.newPassword || data.newPassword.length<6) return alert("La nuova password deve avere almeno 6 caratteri.");
    if(data.newPassword!==data.confirmPassword) return alert("Le due password nuove non coincidono.");
    await api("/api/admin/change-password",{method:"POST",body:JSON.stringify({currentPassword:data.currentPassword,newPassword:data.newPassword})});
    await showAdminConfirm({title:"Password aggiornata",message:"La password admin è stata cambiata.",confirmText:"OK"});
}
document.getElementById("refreshAdmin")?.addEventListener("click",loadAdmin);
document.getElementById("changeAdminPasswordBtn")?.addEventListener("click",changeAdminPassword);
loadAdmin();
