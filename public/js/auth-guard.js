(async function(){
    const pub=["index.html","login.html","register.html","reset-password.html","verify-email.html","info.html"];
    const page=location.pathname.split("/").pop()||"index.html";
    if(pub.includes(page)) return;

    try{
        const r=await fetch("/api/auth/me");
        if(r.status===401) return location.href="/login.html";
        const j=await r.json();
        if(!j.success) return location.href="/login.html";
        window.archeryUser=j.user;

        const adminBtn=document.getElementById("adminHomeBtn");
        if(adminBtn && j.user && j.user.role==="admin") adminBtn.style.display="inline-flex";

        if(page==="admin.html" && (!j.user || j.user.role!=="admin")){
            return location.href="/home.html";
        }
    }catch(e){
        location.href="/login.html";
    }
})();
async function logoutArcheryScore(){
    await fetch("/api/auth/logout",{method:"POST"});
    location.href="/index.html";
}
