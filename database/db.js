const fs = require("fs");
const path = require("path");

/*
  ArcheryScore database adapter

  Locale:
    usa SQLite, come prima.

  Online / Render:
    se esiste process.env.DATABASE_URL usa PostgreSQL.

  L'oggetto esportato mantiene i metodi stile sqlite3 usati dal server:
    db.run(sql, params, cb)
    db.get(sql, params, cb)
    db.all(sql, params, cb)
    db.prepare(sql)
    db.serialize(cb)
*/

const DATABASE_URL = process.env.DATABASE_URL || "";
const usePostgres = !!DATABASE_URL;

if (!usePostgres) {
    const sqlite3 = require("sqlite3").verbose();

    const dataDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, "gare.sqlite");
    const db = new sqlite3.Database(dbPath, err => {
        if (err) {
            console.error("Errore SQLite:", err.message);
        } else {
            console.log("SQLite connesso");
        }
    });

    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS gare(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 1,
                codice_gara TEXT,
                nome TEXT,
                data TEXT,
                luogo TEXT,
                indirizzo TEXT,
                lat REAL,
                lng REAL,
                tipo_gara TEXT,
                tipo_arco TEXT,
                distanza TEXT,
                punteggio INTEGER DEFAULT 0,
                x_count INTEGER DEFAULT 0,
                ten_count INTEGER DEFAULT 0,
                eleven_count INTEGER DEFAULT 0,
                nine_count INTEGER DEFAULT 0,
                five_count INTEGER DEFAULT 0,
                miss_count INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
    });

    module.exports = db;
    return;
}

const { Pool } = require("pg");

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("render.com") || DATABASE_URL.includes("postgres.render.com")
        ? { rejectUnauthorized: false }
        : false
});

function normalizeSql(sql) {
    let out = String(sql || "");

    out = out.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, "SERIAL PRIMARY KEY");
    out = out.replace(/datetime\s*\(\s*'now'\s*\)/gi, "NOW()");
    out = out.replace(/CURRENT_TIMESTAMP/gi, "CURRENT_TIMESTAMP");

    // Caso usato per creare l'admin iniziale
    out = out.replace(
        /INSERT\s+OR\s+IGNORE\s+INTO\s+users\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
        "INSERT INTO users($1) VALUES($2) ON CONFLICT (id) DO NOTHING"
    );

    // SQLite accetta colonne senza tipo rigido; PostgreSQL no, ma le query del progetto sono semplici.
    return out;
}

function convertPlaceholders(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => "$" + (++i));
}

function translate(sql) {
    return convertPlaceholders(normalizeSql(sql));
}

function callbackOrThrow(cb, err, value, context = {}) {
    if (typeof cb === "function") {
        cb.call(context, err, value);
        return;
    }

    if (err) {
        console.error(err);
    }
}

async function initPostgres() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS gare(
            id SERIAL PRIMARY KEY,
            user_id INTEGER DEFAULT 1,
            codice_gara TEXT,
            nome TEXT,
            data TEXT,
            luogo TEXT,
            indirizzo TEXT,
            lat REAL,
            lng REAL,
            tipo_gara TEXT,
            tipo_arco TEXT,
            distanza TEXT,
            punteggio INTEGER DEFAULT 0,
            x_count INTEGER DEFAULT 0,
            ten_count INTEGER DEFAULT 0,
            eleven_count INTEGER DEFAULT 0,
            nine_count INTEGER DEFAULT 0,
            five_count INTEGER DEFAULT 0,
            miss_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS score_entries(
            id SERIAL PRIMARY KEY,
            gara_id INTEGER,
            serie INTEGER,
            volee INTEGER,
            freccia INTEGER,
            valore TEXT
        )
    `);
}

const ready = initPostgres()
    .then(() => console.log("PostgreSQL connesso"))
    .catch(err => {
        console.error("Errore PostgreSQL:", err);
        throw err;
    });

async function runQuery(sql, params = []) {
    await ready;

    const originalSql = String(sql || "");
    let finalSql = translate(originalSql);

    // sqlite3 restituisce this.lastID sugli INSERT.
    // Lo emuliamo per le tabelle principali che hanno id.
    const insertMatch = originalSql.trim().match(/^INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+([a-zA-Z0-9_]+)/i);
    const table = insertMatch ? insertMatch[1].toLowerCase() : "";
    const wantsId = ["users", "gare", "allenamenti"].includes(table);

    if (wantsId && !/RETURNING\s+id/i.test(finalSql)) {
        finalSql += " RETURNING id";
    }

    return pool.query(finalSql, params);
}

const db = {
    serialize(cb) {
        ready.then(() => {
            if (typeof cb === "function") cb();
        }).catch(err => console.error(err));
    },

    run(sql, params, cb) {
        if (typeof params === "function") {
            cb = params;
            params = [];
        }

        runQuery(sql, params || [])
            .then(result => {
                const lastID = result.rows && result.rows[0] ? result.rows[0].id : undefined;
                const changes = typeof result.rowCount === "number" ? result.rowCount : 0;
                callbackOrThrow(cb, null, undefined, { lastID, changes });
            })
            .catch(err => callbackOrThrow(cb, err));
    },

    get(sql, params, cb) {
        if (typeof params === "function") {
            cb = params;
            params = [];
        }

        this.all(sql, params || [], (err, rows) => {
            if (err) return cb(err);
            cb(null, rows && rows.length ? rows[0] : undefined);
        });
    },

    all(sql, params, cb) {
        if (typeof params === "function") {
            cb = params;
            params = [];
        }

        const originalSql = String(sql || "").trim();

        // Emula PRAGMA table_info(nome_tabella)
        const pragma = originalSql.match(/^PRAGMA\s+table_info\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i);
        if (pragma) {
            ready.then(() => {
                return pool.query(
                    `
                    SELECT column_name AS name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = $1
                    ORDER BY ordinal_position
                    `,
                    [pragma[1]]
                );
            })
            .then(result => callbackOrThrow(cb, null, result.rows))
            .catch(err => callbackOrThrow(cb, err));
            return;
        }

        ready.then(() => pool.query(translate(originalSql), params || []))
            .then(result => callbackOrThrow(cb, null, result.rows || []))
            .catch(err => callbackOrThrow(cb, err));
    },

    prepare(sql) {
        const statementSql = sql;
        return {
            run(...args) {
                let cb = null;
                if (args.length && typeof args[args.length - 1] === "function") {
                    cb = args.pop();
                }
                db.run(statementSql, args, cb);
            },

            finalize(cb) {
                if (typeof cb === "function") {
                    cb(null);
                }
            }
        };
    },

    close(cb) {
        pool.end().then(() => {
            if (typeof cb === "function") cb();
        }).catch(err => {
            if (typeof cb === "function") cb(err);
        });
    }
};

module.exports = db;
