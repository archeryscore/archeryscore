const restoreBtn = document.getElementById("restoreDatabaseBtn");
const restoreInput = document.getElementById("restoreDatabaseInput");

restoreBtn?.addEventListener("click", () => {
    restoreInput?.click();
});

restoreInput?.addEventListener("change", async () => {
    const file = restoreInput.files?.[0];

    if(!file){
        return;
    }

    const ok = await confermaRipristinoDatabase(file.name);

    if(!ok){
        restoreInput.value = "";
        return;
    }

    try{
        restoreBtn.disabled = true;
        restoreBtn.textContent = "⏳ Caricamento...";

        const buffer = await file.arrayBuffer();

        const res = await fetch("/api/restore/database", {
            method:"POST",
            headers:{
                "Content-Type":"application/octet-stream"
            },
            body:buffer
        });

        const result = await res.json();

        if(!result.success){
            mostraRestorePopup(result.message || "Ripristino non riuscito", "error");
            restoreBtn.disabled = false;
            restoreBtn.textContent = "📂 Carica Database";
            restoreInput.value = "";
            return;
        }

        mostraRestorePopup("Database caricato. Il server si riavvia.", "success");

        setTimeout(() => {
            window.location.reload();
        },2500);

    }catch(err){
        console.error(err);
        mostraRestorePopup("Errore caricamento database", "error");
        restoreBtn.disabled = false;
        restoreBtn.textContent = "📂 Carica Database";
        restoreInput.value = "";
    }
});

function confermaRipristinoDatabase(filename){
    return new Promise(resolve => {
        let modal = document.getElementById("restoreConfirmModal");

        if(!modal){
            modal = document.createElement("div");
            modal.id = "restoreConfirmModal";
            modal.className = "confirm-modal hidden";
            modal.innerHTML = `
                <div class="confirm-box">
                    <div class="confirm-icon">📂</div>
                    <h2>Caricare database?</h2>
                    <p>
                        Verrà sostituito il database attuale con:<br>
                        <strong id="restoreFileName"></strong><br><br>
                        Prima del ripristino verrà creata una copia automatica del database attuale.
                    </p>
                    <div class="confirm-actions">
                        <button id="restoreCancel" class="secondary-btn">Annulla</button>
                        <button id="restoreOk" class="restore-confirm-btn">Carica Database</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        }

        document.getElementById("restoreFileName").textContent = filename;

        modal.classList.remove("hidden");

        const cancel = document.getElementById("restoreCancel");
        const ok = document.getElementById("restoreOk");

        const cleanup = value => {
            modal.classList.add("hidden");
            cancel.onclick = null;
            ok.onclick = null;
            resolve(value);
        };

        cancel.onclick = () => cleanup(false);
        ok.onclick = () => cleanup(true);
    });
}

function mostraRestorePopup(testo,tipo="success"){
    let popup = document.getElementById("restorePopup");

    if(!popup){
        popup = document.createElement("div");
        popup.id = "restorePopup";
        popup.className = "restore-popup hidden";
        popup.innerHTML = `
            <div class="restore-popup-icon"></div>
            <div class="restore-popup-text"></div>
        `;
        document.body.appendChild(popup);
    }

    popup.classList.remove("hidden","restore-popup-success","restore-popup-error");
    popup.classList.add(tipo === "success" ? "restore-popup-success" : "restore-popup-error");

    popup.querySelector(".restore-popup-icon").textContent = tipo === "success" ? "✅" : "⚠️";
    popup.querySelector(".restore-popup-text").textContent = testo;

    setTimeout(() => {
        popup.classList.add("hidden");
    },3500);
}
