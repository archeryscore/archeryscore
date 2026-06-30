let badgeData = null;
let activeTab = "tutti";

document.addEventListener("click", e => {
    const btn = e.target.closest(".stats-tab");
    if(!btn) return;

    activeTab = btn.dataset.tab;
    document.querySelectorAll(".stats-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderBadge();
});

caricaBadge();

async function caricaBadge(){
    const res = await fetch("/api/badge");
    badgeData = await res.json();
    renderBadge();
}

function renderBadge(){
    const el = document.getElementById("badgeContainer");
    const rows = badgeData?.[activeTab] || [];

    if(!rows.length){
        el.innerHTML = `<div class="empty-state">Nessuna ricompensa ancora conquistata</div>`;
        return;
    }

    el.innerHTML = `
        <div class="badge-grid">
            ${rows.map(b => `
                <div class="badge-card ${b.kind === "gara" ? "badge-gara" : "badge-allenamento"}">
                    <div class="badge-icon">${b.icona}</div>
                    <div>
                        <h2>${b.titolo}</h2>
                        <p>${b.descrizione}</p>
                        <span>${formatDate(b.data)}</span>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

function formatDate(date){
    if(!date) return "-";
    const p = String(date).split("-");
    if(p.length !== 3) return date;
    return `${p[2]}/${p[1]}/${p[0]}`;
}
