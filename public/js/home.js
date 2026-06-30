caricaStatistiche();

async function caricaStatistiche(){
    try{
        const res = await fetch("/api/statistiche");
        const stats = await res.json();

        document.getElementById("gareCount").textContent = stats.gare;
        document.getElementById("luoghiCount").textContent = stats.luoghi;
    }catch(err){
        console.error(err);
    }
}