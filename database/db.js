const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(
    __dirname,
    "..",
    "data",
    "gare.sqlite"
);

const db = new sqlite3.Database(dbPath, err => {

    if(err){
        console.error(err);
    }else{
        console.log("SQLite connesso");
    }

});

function addColumnIfMissing(table, column, definition){

    db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {

        if(err){
            console.error(err);
            return;
        }

        const exists =
        rows.some(r => r.name === column);

        if(!exists){

            db.run(
                `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
                alterErr => {

                    if(alterErr){
                        console.error(alterErr);
                    }else{
                        console.log(`Colonna aggiunta: ${table}.${column}`);
                    }

                }
            );

        }

    });

}

db.serialize(() => {

    db.run(`
    CREATE TABLE IF NOT EXISTS gare(

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        codice_gara TEXT,

        nome TEXT,

        data TEXT,

        luogo TEXT,

        indirizzo TEXT,

        lat REAL,
        lng REAL,

        tipo_gara TEXT,
        tipo_arco TEXT,

        distanza INTEGER,

        punteggio INTEGER,

        x_count INTEGER DEFAULT 0,
        ten_count INTEGER DEFAULT 0,
        eleven_count INTEGER DEFAULT 0,
        nine_count INTEGER DEFAULT 0,
        five_count INTEGER DEFAULT 0,
        miss_count INTEGER DEFAULT 0,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP

    )
    `);

    db.run(`
    CREATE TABLE IF NOT EXISTS score_entries(

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        gara_id INTEGER,

        serie INTEGER,

        volee INTEGER,

        freccia INTEGER,

        valore TEXT

    )
    `);

    addColumnIfMissing("gare", "indirizzo", "TEXT");
    addColumnIfMissing("gare", "nine_count", "INTEGER DEFAULT 0");
    addColumnIfMissing("gare", "five_count", "INTEGER DEFAULT 0");

});

module.exports = db;