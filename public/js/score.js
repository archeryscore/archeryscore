const form = document.getElementById("garaForm");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const dati = {

        codice_gara:
        document.getElementById("codice_gara").value,

        nome:
        document.getElementById("nome").value,

        data:
        document.getElementById("data").value,

        luogo:
        document.getElementById("luogo").value,

        tipo_gara:
        document.getElementById("tipo_gara").value,

        tipo_arco:
        document.getElementById("tipo_arco").value,

        distanza:
        document.getElementById("distanza").value,

        punteggio:
        document.getElementById("punteggio").value,

        note:
        document.getElementById("note").value
    };

    const risposta = await fetch("/api/gare", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(dati)

    });

    const risultato = await risposta.json();

    if(risultato.success){

        alert("Gara salvata!");

        form.reset();
    }

});