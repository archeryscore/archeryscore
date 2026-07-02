const msg=document.getElementById("loginMessage");

function showMsg(t,type="error"){
    if(msg){
        msg.textContent=t;
        msg.className="login-message "+type;
    }
}

async function post(url,data){
    const r=await fetch(url,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(data)
    });

    let j={};
    try{ j=await r.json(); }catch(e){}

    if(!r.ok && !j.message) j.message="Operazione non riuscita";
    return j;
}

function qs(name){
    return new URLSearchParams(location.search).get(name);
}

document.getElementById("loginForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const j=await post("/api/auth/login",{username:f.get("username"),password:f.get("password")});

    if(!j.success){
        if(j.needs_verification) return showMsg("Devi confermare la tua email prima di accedere. Controlla la posta.");
        return showMsg(j.message||"Login non riuscito");
    }

    location.href="/home.html";
});

document.getElementById("registerForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const email=String(f.get("email")||"").trim();

    const j=await post("/api/auth/register",{username:f.get("username"),email,password:f.get("password")});

    if(!j.success) return showMsg(j.message||"Registrazione non riuscita");

    const resend=document.getElementById("resendVerificationForm");
    if(resend){
        resend.classList.remove("hidden-auth-box");
        resend.querySelector("[name='email']").value=email;
    }

    showMsg(j.message||"Account creato. Controlla la tua email per confermare la registrazione.","success");
    e.target.reset();
});

document.getElementById("resendVerificationForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const j=await post("/api/auth/resend-verification",{email:f.get("email")});
    if(!j.success) return showMsg(j.message||"Invio non riuscito");
    showMsg(j.message||"Se l'account è da confermare, riceverai una nuova email.","success");
});

document.getElementById("requestResetForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const j=await post("/api/password/request-reset",{email:f.get("email")});
    if(!j.success) return showMsg(j.message||"Richiesta non riuscita");
    showMsg(j.message||"Se l'account esiste, riceverai una email per il reset.","success");
});

const resetToken=qs("token");
if(resetToken && document.getElementById("resetForm")){
    document.getElementById("requestResetForm")?.classList.add("hidden-auth-box");
    const resetForm=document.getElementById("resetForm");
    resetForm.classList.remove("hidden-auth-box");
    resetForm.querySelector("[name='token']").value=resetToken;
    showMsg("Link valido: inserisci la nuova password.","success");
}

document.getElementById("resetForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const j=await post("/api/password/reset",{token:f.get("token"),password:f.get("password")});
    if(!j.success) return showMsg(j.message||"Reset non riuscito");
    showMsg("Password aggiornata. Puoi accedere.","success");
    setTimeout(()=>location.href="/login.html",1400);
});

if(location.pathname.endsWith("/verify-email.html")){
    const token=qs("token");
    if(!token){
        showMsg("Link di conferma non valido.");
    }else{
        fetch("/api/auth/verify?token="+encodeURIComponent(token))
            .then(r=>r.json())
            .then(j=>{
                if(!j.success) return showMsg(j.message||"Conferma non riuscita");
                const verifyText=document.getElementById("verifyText");
                if(verifyText) verifyText.textContent="Email confermata correttamente.";
                showMsg("Account attivato. Ora puoi accedere.","success");
            })
            .catch(()=>showMsg("Errore durante la conferma."));
    }
}
