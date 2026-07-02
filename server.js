const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const axios = require("axios");
const cheerio = require("cheerio");
const express = require("express");
const crypto = require("crypto");
const db = require("./database/db");

const app = express();


app.use(express.json({ limit:"50mb" }));

// =======================
// AUTH MULTIUTENTE
// =======================
const COOKIE_NAME = "archeryscore_session";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "archeryscore.support@gmail.com";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3001";
const EMAIL_VERIFICATION_REQUIRED = String(process.env.EMAIL_VERIFICATION_REQUIRED || "false").toLowerCase() === "true";
const EMAIL_PROVIDER_READY = EMAIL_VERIFICATION_REQUIRED && !!process.env.RESEND_API_KEY;


async function sendArcheryMail({to,subject,html,text}){
    if(!process.env.RESEND_API_KEY){
        console.log("Email non attiva, RESEND_API_KEY mancante:", subject, to);
        return {sent:false, reason:"email-disabled"};
    }

    const from = process.env.RESEND_FROM || "ArcheryScore <onboarding@resend.dev>";
    const response = await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{
            "Authorization":"Bearer " + process.env.RESEND_API_KEY,
            "Content-Type":"application/json"
        },
        body:JSON.stringify({from,to:[to],subject,html,text:text||""})
    });

    const data = await response.json().catch(()=>({}));
    if(!response.ok){
        throw new Error(data.message || data.error || JSON.stringify(data));
    }
    console.log("Email inviata via Resend", subject, to, data.id || "");
    return {sent:true,id:data.id};
}

function buildEmailButton(url,label){
    return `<div style="margin:28px 0"><a href="${url}" style="display:inline-block;background:#ffcc00;color:#061044;padding:14px 22px;border-radius:14px;text-decoration:none;font-weight:900">${label}</a></div>`;
}

function archeryEmailTemplate(title,message,buttonHtml,small=""){
    return `<div style="font-family:Arial,sans-serif;background:#020b3a;padding:28px;color:#fff"><div style="max-width:620px;margin:auto;background:#0d1f6b;border:1px solid rgba(255,255,255,.15);border-radius:22px;padding:28px"><h1 style="margin:0 0 10px;color:#ffcc00">🎯 ARCHERYSCORE</h1><h2 style="margin:0 0 18px;color:#fff">${title}</h2><p style="font-size:17px;line-height:1.5;color:#c7d2ff">${message}</p>${buttonHtml||""}${small?`<p style="font-size:13px;line-height:1.4;color:#9aa7d9">${small}</p>`:""}</div></div>`;
}

function isEmailValid(email){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||"").trim());
}

function parseCookies(req){
    const header = req.headers.cookie || "";
    const out = {};
    header.split(";").forEach(part => {
        const p = part.trim();
        if(!p) return;
        const i = p.indexOf("=");
        out[decodeURIComponent(p.slice(0,i))] = decodeURIComponent(p.slice(i+1));
    });
    return out;
}

function hashPassword(password,salt=crypto.randomBytes(16).toString("hex")){
    const hash = crypto.pbkdf2Sync(String(password),salt,120000,64,"sha512").toString("hex");
    return `${salt}:${hash}`;
}

function verifyPassword(password,stored){
    try{
        const [salt,hash] = String(stored || "").split(":");
        if(!salt || !hash) return false;
        const check = hashPassword(password,salt).split(":")[1];
        return crypto.timingSafeEqual(Buffer.from(hash,"hex"),Buffer.from(check,"hex"));
    }catch(e){
        return false;
    }
}

function setSessionCookie(res,token){
    res.setHeader("Set-Cookie",`${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60*60*24*30}`);
}

function clearSessionCookie(res){
    res.setHeader("Set-Cookie",`${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function nowSqlDate(){
    return new Date().toISOString().slice(0,19).replace("T"," ");
}

function addColumnIfMissing(table,column,type,done=()=>{}){
    db.all(`PRAGMA table_info(${table})`,[],(err,rows)=>{
        if(err){
            console.error(`Errore controllo colonna ${table}.${column}:`, err.message);
            done();
            return;
        }

        if((rows || []).some(r => r.name === column)){
            done();
            return;
        }

        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, alterErr => {
            if(alterErr){
                console.error(`Errore aggiunta colonna ${table}.${column}:`, alterErr.message);
            }
            done();
        });
    });
}

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        email_verified INTEGER DEFAULT 1,
        verification_token TEXT,
        blocked INTEGER DEFAULT 0,
        last_login TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sessions(
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS password_resets(
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0
    )`);

    addColumnIfMissing("users","role","TEXT DEFAULT 'user'");
    addColumnIfMissing("users","email_verified","INTEGER DEFAULT 1");
    addColumnIfMissing("users","verification_token","TEXT");
    addColumnIfMissing("users","blocked","INTEGER DEFAULT 0");
    addColumnIfMissing("users","last_login","TEXT");

    db.run("INSERT OR IGNORE INTO users(id,username,email,password_hash,role,email_verified,blocked) VALUES(1,'admin',?,?,'admin',1,0)",[ADMIN_EMAIL,hashPassword("admin123")], err => {
        if(err) console.error("Init admin:", err.message);
        db.run("UPDATE users SET role='admin', email_verified=1, blocked=0 WHERE id=1 OR username='admin'");
    });

    addColumnIfMissing("gare","user_id","INTEGER DEFAULT 1",() => {
        db.run("UPDATE gare SET user_id = 1 WHERE user_id IS NULL", [], err => {
            if(err) console.error("Migrazione gare user_id:", err.message);
        });
    });

    addColumnIfMissing("allenamenti","user_id","INTEGER DEFAULT 1",() => {
        db.run("UPDATE allenamenti SET user_id = 1 WHERE user_id IS NULL", [], err => {
            if(err) console.error("Migrazione allenamenti user_id:", err.message);
        });
    });
});

function authMiddleware(req,res,next){
    if(!req.path.startsWith("/api/")) return next();
    if(req.path.startsWith("/api/auth/") || req.path.startsWith("/api/password/")) return next();

    const token = parseCookies(req)[COOKIE_NAME];

    if(!token){
        return res.status(401).json({ success:false, auth:false, message:"Login richiesto" });
    }

    db.get(`
        SELECT sessions.*, users.username, users.email, users.role, users.email_verified, users.blocked
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
          AND sessions.expires_at > ?
    `,[token, nowSqlDate()],(err,row)=>{
        if(err || !row){
            return res.status(401).json({ success:false, auth:false, message:"Sessione scaduta" });
        }

        if(Number(row.blocked || 0) === 1){
            return res.status(403).json({ success:false, message:"Account bloccato" });
        }
        req.user = {
            id:row.user_id,
            username:row.username,
            email:row.email,
            role:row.role || "user",
            email_verified:Number(row.email_verified || 0),
            blocked:Number(row.blocked || 0)
        };
        next();
    });
}

app.use(authMiddleware);

app.get("/", (req,res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(express.static("public"));

function createSession(userId,res,cb){
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now()+1000*60*60*24*30).toISOString().slice(0,19).replace("T"," ");

    db.run("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)",[token,userId,expires],err=>{
        if(err) return res.status(500).json({ success:false, message:"Errore sessione" });
        setSessionCookie(res,token);
        cb();
    });
}

app.post("/api/auth/register",async (req,res)=>{
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if(username.length < 3 || password.length < 6){
        return res.status(400).json({ success:false, message:"Username minimo 3 caratteri e password minimo 6" });
    }
    if(email && !isEmailValid(email)){
        return res.status(400).json({ success:false, message:"Inserisci una email valida" });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verified = EMAIL_VERIFICATION_REQUIRED ? 0 : 1;

    db.run(
        "INSERT INTO users(username,email,password_hash,role,email_verified,verification_token,blocked) VALUES(?,?,?,?,?,?,0)",
        [username,email,hashPassword(password),"user",verified,verificationToken],
        async function(err){
            if(err) return res.status(400).json({ success:false, message:"Username o email già registrati" });

            if(EMAIL_VERIFICATION_REQUIRED && email){
                const verifyUrl = `${APP_BASE_URL}/verify-email.html?token=${verificationToken}`;
                try{
                    await sendArcheryMail({
                        to:email,
                        subject:"Conferma il tuo account ArcheryScore",
                        text:`Conferma il tuo account aprendo questo link: ${verifyUrl}`,
                        html:archeryEmailTemplate("Conferma il tuo account",`Ciao ${username}, grazie per esserti registrato su ArcheryScore. Per attivare il tuo account conferma la tua email.`,buildEmailButton(verifyUrl,"Conferma email"),`Se il pulsante non funziona, copia questo link nel browser: ${verifyUrl}`)
                    });
                }catch(mailErr){
                    console.error("Errore invio verifica email:", mailErr.message);
                }
                return res.json({success:true,pending_verification:true,message:"Account creato. Controlla la tua email per confermare la registrazione."});
            }

            createSession(this.lastID,res,()=>res.json({
                success:true,
                message:"Account creato. Puoi accedere subito. La verifica email sarà attivata quando avremo il dominio.",
                user:{ id:this.lastID, username, email, role:"user", email_verified:verified }
            }));
        }
    );
});

app.get("/api/auth/verify",(req,res)=>{
    const token = String(req.query.token || "").trim();
    if(!token) return res.status(400).json({success:false,message:"Token mancante"});
    db.get("SELECT id FROM users WHERE verification_token = ?",[token],(err,user)=>{
        if(err || !user) return res.status(400).json({success:false,message:"Link non valido o già utilizzato"});
        db.run("UPDATE users SET email_verified=1, verification_token=NULL WHERE id=?",[user.id],err=>{
            if(err) return res.status(500).json({success:false,message:"Errore conferma email"});
            res.json({success:true,message:"Email confermata. Ora puoi accedere."});
        });
    });
});

app.post("/api/auth/resend-verification",async (req,res)=>{
    if(!EMAIL_VERIFICATION_REQUIRED){
        return res.json({success:true,message:"Verifica email non ancora attiva. Puoi accedere subito."});
    }
    const email = String(req.body.email || "").trim().toLowerCase();
    if(!isEmailValid(email)) return res.status(400).json({success:false,message:"Inserisci una email valida"});
    db.get("SELECT * FROM users WHERE email = ?",[email],async (err,user)=>{
        if(err || !user || Number(user.email_verified||0)===1) return res.json({success:true,message:"Se l'account è da confermare, riceverai una nuova email."});
        const token=crypto.randomBytes(32).toString("hex");
        db.run("UPDATE users SET verification_token=? WHERE id=?",[token,user.id],async()=>{
            const verifyUrl=`${APP_BASE_URL}/verify-email.html?token=${token}`;
            try{ await sendArcheryMail({to:user.email,subject:"Conferma il tuo account ArcheryScore",text:`Conferma: ${verifyUrl}`,html:archeryEmailTemplate("Conferma il tuo account",`Ciao ${user.username}, clicca sul pulsante per attivare il tuo account.`,buildEmailButton(verifyUrl,"Conferma email"),`Link: ${verifyUrl}`)}); }catch(e){ console.error("Errore reinvio verifica:",e.message); }
            res.json({success:true,message:"Se l'account è da confermare, riceverai una nuova email."});
        });
    });
});

app.post("/api/auth/login",(req,res)=>{
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    db.get("SELECT * FROM users WHERE username = ? OR email = ?",[username,username.toLowerCase()],(err,user)=>{
        if(err || !user || !verifyPassword(password,user.password_hash)){
            return res.status(401).json({ success:false, message:"Credenziali non valide" });
        }
        if(Number(user.blocked || 0) === 1){
            return res.status(403).json({ success:false, message:"Account bloccato. Contatta il supporto." });
        }
        if(EMAIL_VERIFICATION_REQUIRED && (user.role || "user") !== "admin" && Number(user.email_verified || 0) !== 1){
            return res.status(403).json({success:false,needs_verification:true,message:"Devi confermare la tua email prima di accedere."});
        }
        db.run("UPDATE users SET last_login = ? WHERE id = ?",[nowSqlDate(),user.id]);
        createSession(user.id,res,()=>res.json({ success:true, user:{ id:user.id, username:user.username, email:user.email, role:user.role||"user", email_verified:Number(user.email_verified||0) } }));
    });
});

app.post("/api/auth/logout",(req,res)=>{
    const token = parseCookies(req)[COOKIE_NAME];
    if(token) db.run("DELETE FROM sessions WHERE token = ?",[token]);
    clearSessionCookie(res);
    res.json({ success:true });
});

app.get("/api/auth/me",(req,res)=>{
    const token = parseCookies(req)[COOKIE_NAME];

    if(!token) return res.status(401).json({ success:false, auth:false });

    db.get(`
        SELECT users.id,users.username,users.email,users.role,users.email_verified,users.blocked
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
          AND sessions.expires_at > ?
    `,[token, nowSqlDate()],(err,user)=>{
        if(err || !user) return res.status(401).json({ success:false, auth:false });
        res.json({ success:true, user });
    });
});

app.post("/api/password/request-reset",(req,res)=>{
    if(!EMAIL_VERIFICATION_REQUIRED){
        return res.json({ success:true, message:"Reset via email non ancora attivo. Contatta l'amministratore." });
    }
    const key = String(req.body.email || req.body.username || "").trim().toLowerCase();
    db.get("SELECT * FROM users WHERE email = ? OR username = ?",[key,key],async (err,user)=>{
        if(err || !user) return res.json({ success:true, message:"Se l'account esiste, riceverai una email per il reset." });
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now()+1000*60*30).toISOString().slice(0,19).replace("T"," ");
        const resetUrl = `${APP_BASE_URL}/reset-password.html?token=${token}`;
        db.run("INSERT INTO password_resets(token,user_id,expires_at) VALUES(?,?,?)",[token,user.id,expires],async()=>{
            try{ await sendArcheryMail({to:user.email,subject:"Reset password ArcheryScore",text:`Reset: ${resetUrl}`,html:archeryEmailTemplate("Reset password",`Ciao ${user.username}, clicca sul pulsante per impostare una nuova password.`,buildEmailButton(resetUrl,"Reimposta password"),`Link: ${resetUrl}`)}); }catch(e){ console.error("Errore invio reset:",e.message); }
            res.json({success:true,message:"Se l'account esiste, riceverai una email per il reset."});
        });
    });
});

app.post("/api/password/reset",(req,res)=>{
    const token = String(req.body.token || "").trim();
    const password = String(req.body.password || "");

    if(password.length < 6) return res.status(400).json({ success:false, message:"Password troppo corta" });

    db.get("SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > ?",[token, nowSqlDate()],(err,row)=>{
        if(err || !row) return res.status(400).json({ success:false, message:"Token non valido o scaduto" });

        db.run("UPDATE users SET password_hash = ? WHERE id = ?",[hashPassword(password),row.user_id],err=>{
            if(err) return res.status(500).json({ success:false });
            db.run("UPDATE password_resets SET used = 1 WHERE token = ?",[token]);
            db.run("DELETE FROM sessions WHERE user_id = ?",[row.user_id]);
            res.json({ success:true, message:"Password aggiornata" });
        });
    });
});



function requireAdmin(req,res,next){
    if(!req.user || req.user.role !== "admin") return res.status(403).json({success:false,message:"Accesso admin negato"});
    next();
}
function dbGetP(sql,params=[]){ return new Promise(resolve=>db.get(sql,params,(err,row)=>resolve(err?null:row))); }
function dbAllP(sql,params=[]){ return new Promise(resolve=>db.all(sql,params,(err,rows)=>resolve(err?[]:(rows||[])))); }

app.get("/api/admin/summary", requireAdmin, async (req,res)=>{
    const utenti=await dbGetP("SELECT COUNT(*) AS total FROM users");
    const verificati=await dbGetP("SELECT COUNT(*) AS total FROM users WHERE email_verified = 1");
    const bloccati=await dbGetP("SELECT COUNT(*) AS total FROM users WHERE blocked = 1");
    const gare=await dbGetP("SELECT COUNT(*) AS total FROM gare");
    const allenamenti=await dbGetP("SELECT COUNT(*) AS total FROM allenamenti");
    res.json({success:true,utenti:Number(utenti?.total||0),verificati:Number(verificati?.total||0),bloccati:Number(bloccati?.total||0),gare:Number(gare?.total||0),allenamenti:Number(allenamenti?.total||0)});
});
app.get("/api/admin/users", requireAdmin, async (req,res)=>{
    const users=await dbAllP(`SELECT users.id,users.username,users.email,users.role,users.email_verified,users.blocked,users.created_at,users.last_login,(SELECT COUNT(*) FROM gare WHERE gare.user_id=users.id) AS gare_count,(SELECT COUNT(*) FROM allenamenti WHERE allenamenti.user_id=users.id) AS allenamenti_count FROM users ORDER BY users.id ASC`);
    res.json({success:true,users});
});
app.get("/api/admin/users/:id/data", requireAdmin, async (req,res)=>{
    const id=Number(req.params.id);
    const user=await dbGetP("SELECT id,username,email,role,email_verified,blocked,created_at,last_login FROM users WHERE id=?",[id]);
    if(!user) return res.status(404).json({success:false,message:"Utente non trovato"});
    const gare=await dbAllP("SELECT * FROM gare WHERE user_id=? ORDER BY data DESC,id DESC",[id]);
    const allenamenti=await dbAllP("SELECT * FROM allenamenti WHERE user_id=? ORDER BY data DESC,id DESC",[id]);
    res.json({success:true,user,gare,allenamenti});
});
app.post("/api/admin/users/:id/verify", requireAdmin, (req,res)=>{
    db.run("UPDATE users SET email_verified=1, verification_token=NULL WHERE id=?",[Number(req.params.id)],err=>err?res.status(500).json({success:false,message:"Errore"}):res.json({success:true}));
});
app.post("/api/admin/users/:id/block", requireAdmin, (req,res)=>{
    const id=Number(req.params.id); if(id===1) return res.status(400).json({success:false,message:"Admin originale protetto"});
    db.run("UPDATE users SET blocked=1 WHERE id=?",[id],err=>err?res.status(500).json({success:false}):res.json({success:true}));
});
app.post("/api/admin/users/:id/unblock", requireAdmin, (req,res)=>{
    db.run("UPDATE users SET blocked=0 WHERE id=?",[Number(req.params.id)],err=>err?res.status(500).json({success:false}):res.json({success:true}));
});
app.post("/api/admin/users/:id/role", requireAdmin, (req,res)=>{
    const id=Number(req.params.id); if(id===1) return res.status(400).json({success:false,message:"Admin originale protetto"});
    const role=String(req.body.role||"user")==="admin"?"admin":"user";
    db.run("UPDATE users SET role=? WHERE id=?",[role,id],err=>err?res.status(500).json({success:false}):res.json({success:true}));
});
app.delete("/api/admin/users/:id", requireAdmin, (req,res)=>{
    const id=Number(req.params.id); if(id===1) return res.status(400).json({success:false,message:"Admin originale protetto"});
    db.run("DELETE FROM score_entries WHERE gara_id IN (SELECT id FROM gare WHERE user_id=?)",[id],()=>{
        db.run("DELETE FROM allenamento_score_entries WHERE allenamento_id IN (SELECT id FROM allenamenti WHERE user_id=?)",[id],()=>{
            db.run("DELETE FROM gare WHERE user_id=?",[id],()=>{
                db.run("DELETE FROM allenamenti WHERE user_id=?",[id],()=>{
                    db.run("DELETE FROM sessions WHERE user_id=?",[id],()=>{
                        db.run("DELETE FROM password_resets WHERE user_id=?",[id],()=>{
                            db.run("DELETE FROM users WHERE id=?",[id],err=>err?res.status(500).json({success:false,message:"Errore eliminazione"}):res.json({success:true}));
                        });
                    });
                });
            });
        });
    });
});
app.post("/api/admin/change-password", requireAdmin, (req,res)=>{
    const currentPassword=String(req.body.currentPassword||"");
    const newPassword=String(req.body.newPassword||"");
    if(newPassword.length<6) return res.status(400).json({success:false,message:"Nuova password troppo corta"});
    db.get("SELECT * FROM users WHERE id=?",[req.user.id],(err,user)=>{
        if(err || !user || !verifyPassword(currentPassword,user.password_hash)) return res.status(400).json({success:false,message:"Password attuale non corretta"});
        db.run("UPDATE users SET password_hash=? WHERE id=?",[hashPassword(newPassword),req.user.id],err=>err?res.status(500).json({success:false}):res.json({success:true,message:"Password aggiornata"}));
    });
});
app.post("/api/admin/users/:id/reset-password", requireAdmin, (req,res)=>{
    return res.json({success:true,message:"Reset email non attivo fino alla configurazione del dominio. Usa cambio password/admin manuale."});
});

app.get("/api/gare", (req,res) => {
    db.all("SELECT * FROM gare WHERE user_id = ? ORDER BY data DESC", [req.user.id], (err,rows) => {
        if(err) return res.status(500).json(err);
        res.json(rows);
    });
});

app.get("/api/gare/:id", (req,res) => {
    db.get("SELECT * FROM gare WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err,gara) => {
        if(err) return res.status(500).json(err);

        if(!gara){
            return res.status(404).json({
                success:false,
                message:"Gara non trovata"
            });
        }

        db.all(
            `
            SELECT *
            FROM score_entries
            WHERE gara_id = ?
            ORDER BY serie, volee, freccia
            `,
            [req.params.id],
            (err,score) => {
                if(err) return res.status(500).json(err);

                gara.score = score;
                res.json(gara);
            }
        );
    });
});

app.post("/api/gare", (req,res) => {
    const gara = req.body;

    db.run(
        `
        INSERT INTO gare(
            user_id,codice_gara,nome,data,luogo,indirizzo,lat,lng,
            tipo_gara,tipo_arco,distanza,punteggio,
            x_count,ten_count,eleven_count,nine_count,five_count,miss_count
        )
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `,
        [
            req.user.id,
            gara.codice_gara || "",
            gara.nome || "",
            gara.data || "",
            gara.luogo || "",
            gara.indirizzo || "",
            null,
            null,
            gara.tipo_gara || "",
            gara.tipo_arco || "",
            gara.distanza || null,
            gara.punteggio || 0,
            gara.x_count || 0,
            gara.ten_count || 0,
            gara.eleven_count || 0,
            gara.nine_count || 0,
            gara.five_count || 0,
            gara.miss_count || 0
        ],
        function(err){
            if(err) return res.status(500).json(err);

            salvaScore(
                this.lastID,
                gara.score || [],
                () => res.json({
                    success:true,
                    id:this.lastID
                }),
                err => res.status(500).json(err)
            );
        }
    );
});

app.put("/api/gare/:id", (req,res) => {
    const gara = req.body;
    const id = req.params.id;

    db.run(
        `
        UPDATE gare
        SET
            codice_gara = ?,
            nome = ?,
            data = ?,
            luogo = ?,
            indirizzo = ?,
            lat = ?,
            lng = ?,
            tipo_gara = ?,
            tipo_arco = ?,
            distanza = ?,
            punteggio = ?,
            x_count = ?,
            ten_count = ?,
            eleven_count = ?,
            nine_count = ?,
            five_count = ?,
            miss_count = ?
        WHERE id = ? AND user_id = ?
        `,
        [
            gara.codice_gara || "",
            gara.nome || "",
            gara.data || "",
            gara.luogo || "",
            gara.indirizzo || "",
            null,
            null,
            gara.tipo_gara || "",
            gara.tipo_arco || "",
            gara.distanza || null,
            gara.punteggio || 0,
            gara.x_count || 0,
            gara.ten_count || 0,
            gara.eleven_count || 0,
            gara.nine_count || 0,
            gara.five_count || 0,
            gara.miss_count || 0,
            id,
            req.user.id
        ],
        err => {
            if(err) return res.status(500).json(err);

            db.run("DELETE FROM score_entries WHERE gara_id = ?", [id], err => {
                if(err) return res.status(500).json(err);

                salvaScore(
                    id,
                    gara.score || [],
                    () => res.json({
                        success:true,
                        id:Number(id),
                        updated:true
                    }),
                    err => res.status(500).json(err)
                );
            });
        }
    );
});

function salvaScore(garaId,score,onSuccess,onError){
    if(!score || score.length === 0){
        onSuccess();
        return;
    }

    const stmt = db.prepare(`
        INSERT INTO score_entries(
            gara_id,serie,volee,freccia,valore
        )
        VALUES(?,?,?,?,?)
    `);

    let errore = null;

    score.forEach(r => {
        stmt.run(
            garaId,
            r.serie,
            r.volee,
            r.freccia,
            r.valore,
            err => {
                if(err) errore = err;
            }
        );
    });

    stmt.finalize(err => {
        if(err || errore){
            onError(err || errore);
            return;
        }

        onSuccess();
    });
}

app.delete("/api/gare/:id", (req,res) => {
    const id = req.params.id;

    db.run("DELETE FROM score_entries WHERE gara_id = ?", [id], err => {
        if(err) return res.status(500).json(err);

        db.run("DELETE FROM gare WHERE id = ? AND user_id = ?", [id, req.user.id], err => {
            if(err) return res.status(500).json(err);
            res.json({ success:true });
        });
    });
});

app.delete("/api/gare", (req,res) => {
    db.run("DELETE FROM score_entries WHERE gara_id IN (SELECT id FROM gare WHERE user_id = ?)", [req.user.id], err => {
        if(err) return res.status(500).json(err);

        db.run("DELETE FROM gare WHERE user_id = ?", [req.user.id], err => {
            if(err) return res.status(500).json(err);
            res.json({ success:true });
        });
    });
});

app.get("/api/statistiche", (req,res) => {
    db.get(
        `
        SELECT
            COUNT(*) AS gare,
            COUNT(DISTINCT luogo) AS luoghi
        FROM gare
            WHERE user_id = ?
        `,
        [req.user.id],
        (err,row) => {
            if(err) return res.status(500).json(err);

            res.json({
                gare:row.gare || 0,
                luoghi:row.luoghi || 0
            });
        }
    );
});
app.get("/api/fitarco/:codice", async (req,res) => {
    const codice = req.params.codice.trim().toUpperCase();

    try{
        const garaExcel =
        await cercaGaraExcelFitarco(codice);

        if(!garaExcel){
            const garaOnline = await cercaGaraOnlineFitarco(codice);
            if(garaOnline){
                return res.json({success:true, fonte:garaOnline.fonte||"fitarco-online", nome:garaOnline.nome||"Gara "+codice, data:garaOnline.data||"", luogo:garaOnline.luogo||"", indirizzo:garaOnline.indirizzo||"", tipo_gara:garaOnline.tipo_gara||"Targa", distanza:garaOnline.distanza||"", all_aperto:!!garaOnline.all_aperto});
            }
            return res.json({ success:false, message:"Gara non trovata. Inseriscila manualmente." });
        }

        const garaInvito =
        await cercaInvitoFitarco(codice);

        res.json({
    success:true,
    fonte:garaInvito?.indirizzo ? "excel + fitarco-invito" : "excel",
    nome:garaExcel.nome || "Gara " + codice,
    data:garaExcel.data || "",
    luogo:garaExcel.luogo || "",
    indirizzo:garaInvito?.indirizzo || "",
    tipo_gara:garaExcel.tipo_gara || garaInvito?.tipo_gara || "Targa",
    distanza:garaExcel.distanza || "",
    all_aperto:garaExcel.all_aperto || garaExcel.tipo_gara === "Indoor all'aperto 😉"
});

    }catch(err){
        console.error(err);

        res.status(500).json({
            success:false,
            error:err.message
        });
    }
});


async function cercaGaraOnlineFitarco(codice){
    const invito = await cercaInvitoFitarco(codice);
    if(invito && (invito.indirizzo || invito.nome || invito.luogo)) return {...invito, fonte:"fitarco-invito"};

    const urls = [
        `https://www.fitarco.it/gare-e-risultati/calendario.html`,
        `https://www.fitarco.it/gare-e-risultati/calendario.html?codice=${encodeURIComponent(codice)}`
    ];
    for(const url of urls){
        try{
            const response = await axios.get(url,{timeout:15000,headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ArcheryScore","Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","Accept-Language":"it-IT,it;q=0.9,en;q=0.8"}});
            const $=cheerio.load(response.data);
            const text=$("body").text().replace(/\s+/g," ");
            if(!text.toUpperCase().includes(codice)) continue;
            let row="";
            $("tr,li,.views-row,.item,div").each((_,el)=>{const t=$(el).text().replace(/\s+/g," ").trim(); if(!row && t.toUpperCase().includes(codice)) row=t;});
            const src=row||text;
            return {fonte:"fitarco-calendario",nome:(src.slice(0,120)||"Gara FITARCO "+codice),data:estraiDataDaTesto(src),luogo:"",indirizzo:"",tipo_gara:normalizzaTipoGaraDaRiga([src],"","",src)||"Targa",distanza:estraiDistanzaDaTesto(src),all_aperto:normalizzaStringa(src).includes("aperto")};
        }catch(err){
            console.error("Errore calendario FITARCO online:", err.message);
        }
    }
    return null;
}

async function cercaGaraExcelFitarco(codice){

    const cartella =
    path.join(__dirname,"data","calendari");

    if(!fs.existsSync(cartella)){
        return null;
    }

    const files =
    fs.readdirSync(cartella)
    .filter(file =>
        /^calendario\d{4}\.xlsx$/i.test(file)
    )
    .sort()
    .reverse();

    for(const file of files){

        const workbook =
        new ExcelJS.Workbook();

        try{
            await workbook.xlsx.readFile(
                path.join(cartella,file)
            );
        }catch(err){
            console.error("Errore lettura Excel:", file, err.message);
            continue;
        }

        for(const sheet of workbook.worksheets){

            const rows = [];

            sheet.eachRow(row => {
                rows.push(
                    row.values.slice(1).map(v => normalizzaValoreExcel(v))
                );
            });

            const headerInfo =
            trovaHeaderCalendarioExcel(rows);

            for(const row of rows){

                const testoRiga =
                row.join(" ").toUpperCase();

                if(!testoRiga.includes(codice)){
                    continue;
                }

                return normalizzaRigaExcelFitarco(row,codice,headerInfo);
            }
        }
    }

    return null;
}

function normalizzaValoreExcel(v){

    if(v instanceof Date){
        return v.toLocaleDateString("it-IT");
    }

    if(v && typeof v === "object" && v.text){
        return String(v.text);
    }

    if(v && typeof v === "object" && v.richText){
        return v.richText.map(r => r.text).join("");
    }

    if(v && typeof v === "object" && v.result){
        return String(v.result);
    }

    return String(v || "");
}


function getCellaDaHeader(celle,headerInfo,campo){

    if(!headerInfo || headerInfo[campo] === undefined){
        return "";
    }

    return celle[headerInfo[campo]] || "";
}

function trovaHeaderCalendarioExcel(rows){

    for(let r = 0; r < rows.length; r++){

        const normalized =
        rows[r].map(c => normalizzaStringa(c));

        const hasUsefulHeader =
        normalized.some(c => c.includes("dettaglio")) ||
        normalized.some(c => c.includes("tipologia")) ||
        normalized.some(c => c.includes("localita")) ||
        normalized.some(c => c.includes("luogo"));

        if(!hasUsefulHeader){
            continue;
        }

        const map = {};

        normalized.forEach((header,index) => {

            if(!header){
                return;
            }

            if(header.includes("dettaglio")){
                map.dettaglio = index;
            }

            if(
                header.includes("tipologia") ||
                header.includes("tipo gara") ||
                header.includes("specialita")
            ){
                map.tipologia = index;
            }

            if(
                header === "data" ||
                header.includes("data gara") ||
                header.includes("inizio")
            ){
                map.data = index;
            }

            if(
                header.includes("localita") ||
                header.includes("luogo") ||
                header.includes("comune")
            ){
                map.luogo = index;
            }
        });

        return map;
    }

    return null;
}


function isValoreTipologia(value){
    const t = normalizzaStringa(value);

    return (
        t === "18" ||
        t === "25" ||
        t === "18m" ||
        t === "25m" ||
        t === "18 m" ||
        t === "25 m" ||
        t === "18 metri" ||
        t === "25 metri" ||
        t === "25+18" ||
        t === "18+25" ||
        t === "25 + 18" ||
        t === "18 + 25"
    );
}

function normalizzaRigaExcelFitarco(row,codice,headerInfo = null){

    const celle =
    row.map(v =>
        String(v || "")
        .replace(/\s+/g," ")
        .trim()
    );

    const testo =
    celle.join(" ");

    const testoNorm =
    normalizzaStringa(testo);

    const allAperto =
    testoNorm.includes("all aperto") ||
    testoNorm.includes("allaperto") ||
    testoNorm.includes("aperto");

    let dettaglio =
    getCellaDaHeader(celle,headerInfo,"dettaglio");

    let tipologia =
    getCellaDaHeader(celle,headerInfo,"tipologia");

    if(!dettaglio || isValoreTipologia(dettaglio)){
        dettaglio = trovaDettaglioInCelle(celle,codice);
    }

    if(!tipologia || !isValoreTipologia(tipologia)){
        tipologia = trovaTipologiaInCelle(celle);
    }

    const data =
    getCellaDaHeader(celle,headerInfo,"data") ||
    estraiDataDaTesto(testo);

    const luogo =
    pulisciLuogoExcel(
        getCellaDaHeader(celle,headerInfo,"luogo") ||
        trovaLocalitaInCelle(celle)
    );

    const tipo =
    normalizzaTipoGaraDaRiga(celle,dettaglio,tipologia,testo);

    const nomeBase =
    dettaglio ||
    trovaNomeGaraInCelle(celle,codice);

    const nome =
    pulisciNomeGaraExcel(nomeBase);

    return {
        nome:nome || "Gara FITARCO " + codice,
        data:data,
        luogo:luogo,
        tipo_gara:tipo,
        distanza:estraiDistanzaDaRiga(celle,dettaglio,tipologia,testo,tipo),
        all_aperto:allAperto || tipo === "Indoor all'aperto 😉"
    };
}

function estraiDistanzaDaTesto(testo){

    const t =
    normalizzaStringa(testo);

    if(t.includes("25+18") || t.includes("18+25") || t.includes("25 + 18") || t.includes("18 + 25")){
        return "18+25";
    }

    if(/\b25\s*m\b/.test(t) || /\b25m\b/.test(t) || /\b25\s*metri\b/.test(t)){
        return "25";
    }

    if(/\b18\s*m\b/.test(t) || /\b18m\b/.test(t) || /\b18\s*metri\b/.test(t)){
        return "18";
    }

    return "";
}



function estraiDistanzaDaTipo(tipo){

    if(tipo === "Targa 18+25m" || tipo === "Indoor 18+25"){
        return "18+25";
    }

    if(tipo === "Targa 18m" || tipo === "Indoor 18m"){
        return "18";
    }

    if(tipo === "Targa 25m" || tipo === "Indoor 25m"){
        return "25";
    }

    return "";
}

function estraiDistanzaDaRiga(celle,dettaglio,tipologia,testo,tipo){

    const tipologiaNorm =
    normalizzaStringa(tipologia);

    const all =
    normalizzaStringa(
        [...celle,dettaglio,tipologia,testo].join(" ")
    );

    if(
        tipologiaNorm.includes("25+18") ||
        tipologiaNorm.includes("18+25") ||
        tipologiaNorm.includes("25 + 18") ||
        tipologiaNorm.includes("18 + 25")
    ){
        return "18+25";
    }

    if(
        tipologiaNorm === "25" ||
        /\b25\s*m\b/.test(tipologiaNorm) ||
        /\b25m\b/.test(tipologiaNorm) ||
        /\b25\s*metri\b/.test(tipologiaNorm)
    ){
        return "25";
    }

    if(
        tipologiaNorm === "18" ||
        /\b18\s*m\b/.test(tipologiaNorm) ||
        /\b18m\b/.test(tipologiaNorm) ||
        /\b18\s*metri\b/.test(tipologiaNorm)
    ){
        return "18";
    }

    if(all.includes("25+18") || all.includes("18+25") || all.includes("25 + 18") || all.includes("18 + 25")){
        return "18+25";
    }

    if(/\b25\s*m\b/.test(all) || /\b25m\b/.test(all) || /\b25\s*metri\b/.test(all)){
        return "25";
    }

    if(/\b18\s*m\b/.test(all) || /\b18m\b/.test(all) || /\b18\s*metri\b/.test(all)){
        return "18";
    }

    return estraiDistanzaDaTipo(tipo);
}


function trovaDettaglioInCelle(celle,codice){

    const buone =
    celle.filter(c => {
        const testo = String(c || "").trim();
        const n = normalizzaStringa(testo);

        if(!testo) return false;
        if(testo.toUpperCase().includes(codice)) return false;
        if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(testo)) return false;
        if(/\([A-Z]{2}\)/.test(testo)) return false;
        if(isValoreTipologia(testo)) return false;
        if(n === "all aperto" || n === "allaperto" || n === "aperto") return false;
        if(n.includes("designazione") || n.includes("giudice") || n.includes("arbitro")) return false;

        return (
            n.includes("interregionale") ||
            n.includes("nazionale") ||
            n.includes("regionale") ||
            n.includes("campionato") ||
            n.includes("trofeo") ||
            n.includes("memorial") ||
            n.includes("gara") ||
            n.includes("freccia") ||
            n.includes("coppa") ||
            n.includes("torneo")
        );
    });

    const conNome =
    buone.find(c => {
        const n = normalizzaStringa(c);
        return (
            n.includes("gara") ||
            n.includes("interregionale") ||
            n.includes("nazionale") ||
            n.includes("regionale") ||
            n.includes("campionato") ||
            n.includes("trofeo") ||
            n.includes("memorial") ||
            n.includes("freccia") ||
            n.includes("coppa") ||
            n.includes("torneo")
        );
    });

    return conNome || buone[0] || "";
}


function trovaTipologiaInCelle(celle){

    const exact =
    celle.find(c => isValoreTipologia(c));

    if(exact){
        return exact;
    }

    const joined =
    normalizzaStringa(celle.join(" "));

    if(joined.includes("25+18")) return "25+18";
    if(joined.includes("18+25")) return "18+25";
    if(/\b25\s*m\b/.test(joined) || /\b25m\b/.test(joined)) return "25";
    if(/\b18\s*m\b/.test(joined) || /\b18m\b/.test(joined)) return "18";

    return "";
}


function trovaLocalitaInCelle(celle){

    const conProvincia =
    celle.find(c => /\([A-Z]{2}\)/.test(c));

    return conProvincia || "";
}

function trovaNomeGaraInCelle(celle,codice){

    const candidate =
    celle.filter(c =>
        c &&
        !c.toUpperCase().includes(codice) &&
        !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(c) &&
        !/^\d+$/.test(c) &&
        c.length > 6
    );

    const nomeForte =
    candidate.find(c =>
        /trofeo|campionato|coppa|gara|memorial|meeting|targa|frecce|torneo/i.test(c)
    );

    return nomeForte || candidate[candidate.length - 1] || "";
}

function pulisciLuogoExcel(luogo){

    const match =
    String(luogo || "")
    .match(/([A-Z�-�a-z�-�'�.\s-]+)\(([A-Z]{2})\)/);

    return match
        ? match[0].trim()
        : String(luogo || "").trim();
}

function pulisciNomeGaraExcel(nome){

    let testo =
    String(nome || "")
    .replace(/\s+/g," ")
    .trim();

    if(!testo){
        return "";
    }

    const n0 =
    normalizzaStringa(testo);

    if(isValoreTipologia(testo)){
        return "";
    }

    if(
        n0 === "all aperto" ||
        n0 === "allaperto" ||
        n0 === "aperto"
    ){
        return "";
    }

    testo =
    testo
    .replace(/^all['’]?\s*aperto\s*/i,"")
    .replace(/^aperto\s*/i,"")
    .replace(/\s+all['’]?\s*aperto$/i,"")
    .trim();

    const n =
    normalizzaStringa(testo);

    if(
        n.includes("designazione") ||
        n.includes("giudice") ||
        n.includes("arbitro")
    ){
        return "";
    }

    return testo;
}
async function cercaInvitoFitarco(codice){
    const urls = [
        `https://www.fitarco-italia.org/gare/vediinvito.php?CodGara=${codice}`,
        `https://fitarco-italia.org/gare/vediinvito.php?CodGara=${codice}`,
        `https://www.fitarco.it/gare/vediinvito.php?CodGara=${codice}`
    ];

    for(const url of urls){
        try{
            const response =
            await axios.get(url,{
                timeout:12000,
                headers:{
                    "User-Agent":"Mozilla/5.0 ArcheryScore"
                }
            });

            const gara =
            estraiDatiInvitoFitarco(response.data,codice);

            if(gara && gara.indirizzo){
                return gara;
            }

        }catch(err){
            console.error("Invito FITARCO non letto:", codice, err.message);
        }
    }

    return null;
}

function estraiDatiInvitoFitarco(html,codice){
    const $ =
    cheerio.load(html);

    $("script, style, noscript").remove();

    const testo =
    $("body")
    .text()
    .replace(/\r/g,"\n")
    .replace(/\t/g," ")
    .replace(/\u00a0/g," ")
    .replace(/[ ]+/g," ")
    .replace(/\n[ ]+/g,"\n")
    .replace(/[ ]+\n/g,"\n")
    .trim();

    if(!testo){
        return null;
    }

    const lineare =
    testo.replace(/\s+/g," ").trim();

    const indirizzo =
    estraiIndirizzoInvito(testo,lineare);

    return {
        nome:estraiNomeInvito(testo,codice) || "",
        data:estraiDataDaTesto(lineare) || estraiDataCompatta(lineare),
        luogo:estraiLuogoDaIndirizzo(indirizzo) || "",
        indirizzo,
        tipo_gara:normalizzaTipoGaraDaTesto(lineare)
    };
}

function estraiIndirizzoInvito(testoMultiriga,testoLineare){
    const righe =
    testoMultiriga
    .split("\n")
    .map(r => r.replace(/\s+/g," ").trim())
    .filter(Boolean);

    for(let i = 0; i < righe.length; i++){
        const rigaNorm =
        normalizzaStringa(righe[i]);

        if(!rigaNorm.includes("luogo di gara")){
            continue;
        }

        const parti = [];

        const stessaRiga =
        righe[i]
        .replace(/luogo\s+di\s+gara\s*:?\s*/i,"")
        .trim();

        if(stessaRiga){
            parti.push(stessaRiga);
        }

        for(let j = i + 1; j < righe.length && parti.length < 8; j++){
            const r = righe[j];

            if(
                /^vedi/i.test(r) ||
                /responsabile/i.test(r) ||
                /contatti/i.test(r) ||
                /programma/i.test(r) ||
                /iscrizioni/i.test(r) ||
                /organizz/i.test(r) ||
                /^note$/i.test(r)
            ){
                break;
            }

            parti.push(r);

            if(/\([A-Z]{2}\)/i.test(r)){
                break;
            }
        }

        const indirizzo =
        pulisciIndirizzoInvito(parti.join(" "));

        if(indirizzo && indirizzo.length > 5){
            return indirizzo;
        }
    }

    const match =
    testoLineare.match(
        /Luogo\s+di\s+Gara\s+(.+?)(?:Vedi\s+sulla\s+Mappa|Responsabile|Contatti|Programma|Note|Iscrizioni|Organizz|$)/i
    );

    if(match){
        const indirizzo =
        pulisciIndirizzoInvito(match[1]);

        if(indirizzo && indirizzo.length > 5){
            return indirizzo;
        }
    }

    return "";
}
function pulisciIndirizzoInvito(indirizzo){
    return String(indirizzo || "")
    .replace(/\s+/g," ")
    .replace(/\s*,\s*/g,", ")
    .replace(/\(\s*([A-Z]{2})\s*\)/g,"($1)")
    .replace(/\s*-\s*/g," - ")
    .replace(/^[:\-]\s*/,"")
    .replace(/\s*Vedi\s+sulla\s+Mappa.*$/i,"")
    .trim();
}

function estraiLuogoDaIndirizzo(indirizzo){
    const testo =
    String(indirizzo || "");

    const cap =
    testo.match(
        /\b\d{5}\s+([A-Z�-�a-z�-�'�.\s-]+)\s*\(([A-Z]{2})\)/i
    );

    if(cap){
        return `${cap[1].trim()} (${cap[2].toUpperCase()})`;
    }

    const matches =
    [...testo.matchAll(/([A-Z�-�a-z�-�'�.\s-]+)\s*\(([A-Z]{2})\)/gi)];

    if(matches.length > 0){
        const last =
        matches[matches.length - 1];

        return `${last[1].trim()} (${last[2].toUpperCase()})`;
    }

    return "";
}

function estraiNomeInvito(testo,codice){
    const righe =
    testo
    .split("\n")
    .map(r => r.trim())
    .filter(Boolean);

    return righe.find(r =>
        r.length > 8 &&
        !r.toUpperCase().includes(codice) &&
        /trofeo|memorial|campionato|coppa|gara|frecce|round|indoor|torneo/i.test(r)
    ) || "";
}

function estraiDataCompatta(testo){
    const m =
    String(testo || "")
    .match(/(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})/);

    if(!m){
        return "";
    }

    return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
}

function estraiDataDaTesto(testo){
    const match =
    String(testo || "")
    .match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

    if(!match){
        return "";
    }

    return `${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`;
}

function normalizzaTipoGaraDaTesto(testo){

    const t =
    normalizzaStringa(testo);

    if(t.includes("24+24")) return "Campagna/H&F 24+24";
    if(t.includes("12+12")) return "Campagna/H&F 12+12";

    if(
        t.includes("hunter") ||
        t.includes("field") ||
        t.includes("h+f") ||
        t.includes("hf") ||
        t.includes("campagna")
    ){
        return "Campagna/H&F 12+12";
    }

    if(t.includes("3d")){
        return t.includes("48") ? "3D 48" : "3D 24";
    }

    if(t.includes("doppio")){
        return "Doppio Targa";
    }

    if(t.includes("all aperto") || t.includes("allaperto") || t.includes("aperto")){
        return "Indoor all'aperto 😉";
    }

    if(t.includes("25+18") || t.includes("18+25") || t.includes("25 + 18") || t.includes("18 + 25")){
        return "Indoor 18+25";
    }

    if(/\b25\s*m\b/.test(t) || /\b25m\b/.test(t) || /\b25\s*metri\b/.test(t)){
        return "Indoor 25m";
    }

    if(/\b18\s*m\b/.test(t) || /\b18m\b/.test(t) || /\b18\s*metri\b/.test(t)){
        return "Indoor 18m";
    }

    return "Targa";
}

function normalizzaTipoGaraDaRiga(celle,dettaglio,tipologia,testo){

    const tipologiaNorm =
    normalizzaStringa(tipologia);

    const all =
    normalizzaStringa(
        [...celle,dettaglio,tipologia,testo].join(" ")
    );

    if(all.includes("24+24")) return "Campagna/H&F 24+24";
    if(all.includes("12+12")) return "Campagna/H&F 12+12";

    if(
        all.includes("hunter") ||
        all.includes("field") ||
        all.includes("h+f") ||
        all.includes("hf") ||
        all.includes("campagna")
    ){
        return "Campagna/H&F 12+12";
    }

    if(all.includes("3d")){
        return all.includes("48") ? "3D 48" : "3D 24";
    }

    if(all.includes("doppio")){
        return "Doppio Targa";
    }

    /*
      Regola definitiva:
      se nella riga della gara c'è all'aperto, è Indoor all'aperto.
      La distanza viene dalla tipologia: 18, 25, 25+18.
    */
    if(
        all.includes("all aperto") ||
        all.includes("allaperto") ||
        all.includes("aperto")
    ){
        return "Indoor all'aperto 😉";
    }

    if(
        tipologiaNorm.includes("25+18") ||
        tipologiaNorm.includes("18+25") ||
        tipologiaNorm.includes("25 + 18") ||
        tipologiaNorm.includes("18 + 25")
    ){
        return "Indoor 18+25";
    }

    if(
        tipologiaNorm === "25" ||
        /\b25\s*m\b/.test(tipologiaNorm) ||
        /\b25m\b/.test(tipologiaNorm) ||
        /\b25\s*metri\b/.test(tipologiaNorm)
    ){
        return "Indoor 25m";
    }

    if(
        tipologiaNorm === "18" ||
        /\b18\s*m\b/.test(tipologiaNorm) ||
        /\b18m\b/.test(tipologiaNorm) ||
        /\b18\s*metri\b/.test(tipologiaNorm)
    ){
        return "Indoor 18m";
    }

    return "Targa";
}

function normalizzaTipoGaraDaDatiExcel(dettaglio,tipologia,testoCompleto){
    return normalizzaTipoGaraDaRiga(
        [dettaglio,tipologia,testoCompleto],
        dettaglio,
        tipologia,
        testoCompleto
    );
}

function normalizzaStringa(str){
    return String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g,"")
        .replace(/[’']/g," ")
        .replace(/\s+/g," ")
        .trim();
}


app.get("/api/mappa/gare", async (req,res) => {
    try{
        db.all("SELECT * FROM gare WHERE user_id = ? ORDER BY data DESC", [req.user.id], async (err,rows) => {
            if(err) return res.status(500).json(err);

            const aggiornate = [];

            for(const gara of rows){
                if(gara.lat && gara.lng){
                    aggiornate.push(gara);
                    continue;
                }

                const luogo =
                pulisciLuogoPerMappa(
                    gara.indirizzo && gara.indirizzo.trim()
                        ? gara.indirizzo
                        : gara.luogo
                );

                if(!luogo){
                    aggiornate.push(gara);
                    continue;
                }

                const coordinate =
                await geocodificaLuogo(luogo,gara.luogo);

                if(coordinate){
                    gara.lat = coordinate.lat;
                    gara.lng = coordinate.lng;

                    await aggiornaCoordinateGara(
                        gara.id,
                        coordinate.lat,
                        coordinate.lng
                    );
                }

                aggiornate.push(gara);
                await pausa(1100);
            }

            res.json(aggiornate);
        });

    }catch(err){
        console.error(err);

        res.status(500).json({
            success:false,
            error:err.message
        });
    }
});

function pulisciLuogoPerMappa(luogo){
    if(!luogo){
        return "";
    }

    let pulito =
    String(luogo)
    .replace(/\s+/g," ")
    .replace(/\s*,\s*/g,", ")
    .replace(/\(\s*([A-Z]{2})\s*\)/g,"($1)")
    .replace(/\(([A-Z]{2})\)/g,", $1")
    .replace(/\s*-\s*/g,", ")
    .replace(/,\s*,/g,",")
    .trim();

    if(!pulito.toLowerCase().includes("italia")){
        pulito += ", Italia";
    }

    return pulito;
}

async function geocodificaLuogo(luogo,luogoOriginale){
    const fallback =
    coordinateManuali(luogo + " " + (luogoOriginale || ""));

    const tentativi = [
        luogo,
        luogo.replace(/\bPV\b/g,"Pavia"),
        luogo.replace(/\bGE\b/g,"Genova"),
        luogoOriginale ? `${luogoOriginale}, Italia` : ""
    ].filter(Boolean);

    for(const query of tentativi){
        try{
            const response =
            await axios.get(
                "https://nominatim.openstreetmap.org/search",
                {
                    params:{
                        q:query,
                        format:"json",
                        limit:3,
                        addressdetails:1,
                        countrycodes:"it"
                    },
                    headers:{
                        "User-Agent":"ArcheryScore-local-app/1.0"
                    },
                    timeout:15000
                }
            );

            if(response.data && response.data.length > 0){
                return {
                    lat:Number(response.data[0].lat),
                    lng:Number(response.data[0].lon)
                };
            }

        }catch(err){
            console.error("Errore geocodifica:", query, err.message);
        }

        await pausa(1100);
    }

    return fallback
        ? { lat:fallback.lat, lng:fallback.lng }
        : null;
}

function coordinateManuali(testo){
    const t =
    String(testo || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"");

    if(t.includes("cilavegna")) return { lat:45.3109, lng:8.7449 };
    if(t.includes("sestri levante")) return { lat:44.2709, lng:9.3974 };
    if(t.includes("terni")) return { lat:42.5636, lng:12.6427 };

    return null;
}

function aggiornaCoordinateGara(id,lat,lng){
    return new Promise((resolve,reject) => {
        db.run(
            `
            UPDATE gare
            SET lat = ?, lng = ?
            WHERE id = ?
            `,
            [lat,lng,id],
            err => {
                if(err){
                    reject(err);
                    return;
                }

                resolve();
            }
        );
    });
}

function pausa(ms){
    return new Promise(resolve =>
        setTimeout(resolve,ms)
    );
}



// =======================
// ALLENAMENTI
// =======================

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS allenamenti(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            data TEXT,
            tipo_arco TEXT,
            tipo_allenamento TEXT,
            distanza TEXT,
            piazzole INTEGER,
            punteggio INTEGER DEFAULT 0,
            x_count INTEGER DEFAULT 0,
            ten_count INTEGER DEFAULT 0,
            eleven_count INTEGER DEFAULT 0,
            nine_count INTEGER DEFAULT 0,
            six_count INTEGER DEFAULT 0,
            five_count INTEGER DEFAULT 0,
            miss_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS allenamento_score_entries(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            allenamento_id INTEGER,
            serie INTEGER,
            volee INTEGER,
            freccia INTEGER,
            valore TEXT
        )
    `);

    addColumnIfMissing("allenamenti","user_id","INTEGER DEFAULT 1",() => {
        db.run("UPDATE allenamenti SET user_id = 1 WHERE user_id IS NULL", [], err => {
            if(err) console.error("Migrazione allenamenti user_id:", err.message);
        });
    });
});

function salvaScoreAllenamento(allenamentoId,score,onSuccess,onError){
    if(!score || score.length === 0){
        onSuccess();
        return;
    }

    const stmt = db.prepare(`
        INSERT INTO allenamento_score_entries(
            allenamento_id,serie,volee,freccia,valore
        )
        VALUES(?,?,?,?,?)
    `);

    let errore = null;

    score.forEach(r => {
        stmt.run(
            allenamentoId,
            r.serie,
            r.volee,
            r.freccia,
            r.valore,
            err => {
                if(err) errore = err;
            }
        );
    });

    stmt.finalize(err => {
        if(err || errore){
            onError(err || errore);
            return;
        }

        onSuccess();
    });
}

app.get("/api/allenamenti", (req,res) => {
    db.all("SELECT * FROM allenamenti WHERE user_id = ? ORDER BY data DESC, id DESC", [req.user.id], (err,rows) => {
        if(err) return res.status(500).json(err);
        res.json(rows || []);
    });
});

app.get("/api/allenamenti/:id", (req,res) => {
    db.get("SELECT * FROM allenamenti WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err,allenamento) => {
        if(err) return res.status(500).json(err);

        if(!allenamento){
            return res.status(404).json({
                success:false,
                message:"Allenamento non trovato"
            });
        }

        db.all(
            `
            SELECT *
            FROM allenamento_score_entries
            WHERE allenamento_id = ?
            ORDER BY serie, volee, freccia
            `,
            [req.params.id],
            (err,score) => {
                if(err) return res.status(500).json(err);

                allenamento.score = score || [];
                res.json(allenamento);
            }
        );
    });
});

app.post("/api/allenamenti", (req,res) => {
    const a = req.body || {};

    db.run(
        `
        INSERT INTO allenamenti(
            user_id,data,tipo_arco,tipo_allenamento,distanza,piazzole,punteggio,
            x_count,ten_count,eleven_count,nine_count,six_count,five_count,miss_count
        )
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `,
        [
            req.user.id,
            a.data || "",
            a.tipo_arco || "",
            a.tipo_allenamento || "",
            a.distanza || null,
            a.piazzole || null,
            a.punteggio || 0,
            a.x_count || 0,
            a.ten_count || 0,
            a.eleven_count || 0,
            a.nine_count || 0,
            a.six_count || 0,
            a.five_count || 0,
            a.miss_count || 0
        ],
        function(err){
            if(err) return res.status(500).json(err);

            const newId = this.lastID;

            salvaScoreAllenamento(
                newId,
                a.score || [],
                () => res.json({
                    success:true,
                    id:newId
                }),
                err => res.status(500).json(err)
            );
        }
    );
});

app.put("/api/allenamenti/:id", (req,res) => {
    const a = req.body || {};
    const id = req.params.id;

    db.run(
        `
        UPDATE allenamenti
        SET
            data = ?,
            tipo_arco = ?,
            tipo_allenamento = ?,
            distanza = ?,
            piazzole = ?,
            punteggio = ?,
            x_count = ?,
            ten_count = ?,
            eleven_count = ?,
            nine_count = ?,
            six_count = ?,
            five_count = ?,
            miss_count = ?
        WHERE id = ? AND user_id = ?
        `,
        [
            a.data || "",
            a.tipo_arco || "",
            a.tipo_allenamento || "",
            a.distanza || null,
            a.piazzole || null,
            a.punteggio || 0,
            a.x_count || 0,
            a.ten_count || 0,
            a.eleven_count || 0,
            a.nine_count || 0,
            a.six_count || 0,
            a.five_count || 0,
            a.miss_count || 0,
            id,
            req.user.id
        ],
        err => {
            if(err) return res.status(500).json(err);

            db.run("DELETE FROM allenamento_score_entries WHERE allenamento_id = ?", [id], err => {
                if(err) return res.status(500).json(err);

                salvaScoreAllenamento(
                    id,
                    a.score || [],
                    () => res.json({
                        success:true,
                        id:Number(id),
                        updated:true
                    }),
                    err => res.status(500).json(err)
                );
            });
        }
    );
});

app.delete("/api/allenamenti/:id", (req,res) => {
    const id = req.params.id;

    db.run("DELETE FROM allenamento_score_entries WHERE allenamento_id = ?", [id], err => {
        if(err) return res.status(500).json(err);

        db.run("DELETE FROM allenamenti WHERE id = ? AND user_id = ?", [id, req.user.id], err => {
            if(err) return res.status(500).json(err);
            res.json({ success:true });
        });
    });
});






// =======================
// DASHBOARD / STATISTICHE / PROGRESSI
// =======================

function dbAllSafe(sql,params=[]){
    return new Promise(resolve => {
        db.all(sql,params,(err,rows) => {
            if(err){
                console.error("Errore SQL:", sql, err.message);
                resolve([]);
                return;
            }
            resolve(rows || []);
        });
    });
}

function n(v){
    return Number(v || 0);
}

function dataMeno(giorni){
    const d = new Date();
    d.setDate(d.getDate() - giorni);
    return d.toISOString().slice(0,10);
}

async function caricaAnalyticsBase(userId){
    const gare = await dbAllSafe("SELECT * FROM gare WHERE user_id = ? ORDER BY data ASC, id ASC",[userId]);
    const allenamenti = await dbAllSafe("SELECT * FROM allenamenti WHERE user_id = ? ORDER BY data ASC, id ASC",[userId]);

    return {
        gare:gare.map(g => ({
            ...g,
            kind:"gara",
            tipo:g.tipo_gara || g.tipo || "Gara",
            nome:g.nome || "Gara",
            data:g.data || "",
            punteggio:n(g.punteggio),
            distanza:g.distanza || ""
        })),
        allenamenti:allenamenti.map(a => ({
            ...a,
            kind:"allenamento",
            tipo:a.tipo_allenamento || "Allenamento",
            nome:`${a.tipo_allenamento || "Allenamento"} ${a.distanza ? a.distanza + "m" : ""}${a.piazzole ? a.piazzole + " piazzole" : ""}`.trim(),
            data:a.data || "",
            punteggio:n(a.punteggio),
            distanza:a.distanza || "",
            piazzole:a.piazzole || null
        }))
    };
}

function distanzaAnalytics(x){
    if(x.distanza) return `${x.distanza}m`;
    if(x.piazzole) return `${x.piazzole} piazzole`;
    return "";
}

function frecceAnalytics(x){
    const tipo = String(x.tipo || "");

    if(x.kind === "allenamento"){
        if(tipo === "3D") return n(x.piazzole) * 2;
        if(tipo === "Campagna/H&F") return n(x.piazzole) * 3;
        if(tipo === "Indoor") return 60;
        if(tipo === "Targa") return (String(x.distanza) === "18" || String(x.distanza) === "25") ? 60 : 72;
    }

    if(tipo.includes("3D 48")) return 96;
    if(tipo.includes("3D")) return 48;
    if(tipo.includes("24+24")) return 144;
    if(tipo.includes("12+12") || tipo.includes("Campagna")) return 72;
    if(tipo.includes("Doppio")) return 144;
    if(tipo.includes("18+25")) return 120;
    if(tipo.includes("Indoor")) return 60;
    if(tipo.includes("Targa 18") || tipo.includes("Targa 25")) return 60;

    return 72;
}

function puntiFrecciaAnalytics(x){
    const f = frecceAnalytics(x);
    return f ? n(x.punteggio) / f : 0;
}

app.get("/api/dashboard", async (req,res) => {
    try{
        const { gare, allenamenti } = await caricaAnalyticsBase(req.user.id);

        const tutte = [...gare,...allenamenti]
            .filter(x => x.data)
            .sort((a,b) => String(b.data).localeCompare(String(a.data)));

        const ultimaGara = gare
            .filter(x => x.data)
            .sort((a,b) => String(b.data).localeCompare(String(a.data)))[0] || null;

        const ultimoAllenamento = allenamenti
            .filter(x => x.data)
            .sort((a,b) => String(b.data).localeCompare(String(a.data)))[0] || null;

        const mese = new Date().toISOString().slice(0,7);
        const da30 = dataMeno(30);
        const ultimi30 = tutte.filter(x => String(x.data || "") >= da30);

        res.json({
            success:true,
            ultima_gara:ultimaGara,
            ultimo_allenamento:ultimoAllenamento,
            media_30:ultimi30.length
                ? Number((ultimi30.reduce((s,x)=>s+n(x.punteggio),0) / ultimi30.length).toFixed(1))
                : 0,
            allenamenti_mese:allenamenti.filter(a => String(a.data || "").startsWith(mese)).length,
            gare_mese:gare.filter(g => String(g.data || "").startsWith(mese)).length,
            frecce_anno:tutte
                .filter(x => String(x.data || "").startsWith(String(new Date().getFullYear())))
                .reduce((s,x)=>s+frecceAnalytics(x),0)
        });
    }catch(err){
        res.status(500).json({ success:false, error:err.message });
    }
});

app.get("/api/statistiche/complete", async (req,res) => {
    try{
        const gareRaw = await dbAllSafe("SELECT * FROM gare WHERE user_id = ? ORDER BY data ASC,id ASC",[req.user.id]);
        const allenRaw = await dbAllSafe("SELECT * FROM allenamenti WHERE user_id = ? ORDER BY data ASC,id ASC",[req.user.id]);

        const gare = gareRaw.map(g=>({...g,kind:"gara",tipo:g.tipo_gara||"Gara"}));
        const allenamenti = allenRaw.map(a=>({...a,kind:"allenamento",tipo:a.tipo_allenamento||"Allenamento"}));

        function build(items,kind){
            const groups={};
            items.forEach(x=>{
                const nome=`${x.tipo||"Risultato"} ${distanzaAnalytics(x)}`.trim();
                if(!groups[nome]) groups[nome]=[];
                groups[nome].push(x);
            });
            return Object.entries(groups).map(([nome,arr])=>{
                const count=arr.length;
                const totale=arr.reduce((s,x)=>s+n(x.punteggio),0);
                const frecce=arr.reduce((s,x)=>s+frecceAnalytics(x),0);
                return {
                    nome,kind,count,
                    media:count?Number((totale/count).toFixed(1)):0,
                    migliore:Math.max(...arr.map(x=>n(x.punteggio))),
                    peggiore:Math.min(...arr.map(x=>n(x.punteggio))),
                    frecce,
                    media_freccia:frecce?Number((totale/frecce).toFixed(2)):0
                };
            }).sort((a,b)=>a.nome.localeCompare(b.nome));
        }

        res.json([...build(gare,"gara"),...build(allenamenti,"allenamento")]);
    }catch(err){
        res.status(500).json({success:false,error:err.message});
    }
});

app.get("/api/progressi", async (req,res) => {
    try{
        const { gare, allenamenti } = await caricaAnalyticsBase(req.user.id);

        function calcolaProgressiSet(items){
            const tutte = (items || [])
                .filter(x => x.data)
                .sort((a,b)=>String(a.data).localeCompare(String(b.data)));

            if(tutte.length < 2){
                return {
                    eventi:tutte.length,
                    media_prima:0,
                    media_seconda:0,
                    differenza_media:0,
                    ppf_prima:0,
                    ppf_seconda:0,
                    differenza_ppf:0,
                    migliori_trend:[],
                    peggiori_trend:[]
                };
            }

            const meta = Math.ceil(tutte.length / 2);
            const prima = tutte.slice(0,meta);
            const seconda = tutte.slice(meta);

            const media = (arr,fn) =>
                arr.length ? arr.reduce((s,x)=>s+fn(x),0) / arr.length : 0;

            const gruppi = {};

            tutte.forEach(x => {
                const key = `${x.tipo || "Risultato"} ${distanzaAnalytics(x)}`.trim();
                if(!gruppi[key]) gruppi[key] = [];
                gruppi[key].push(x);
            });

            const trend = Object.entries(gruppi)
                .filter(([_,items]) => items.length >= 2)
                .map(([nome,items]) => {
                    const first = items[0];
                    const last = items[items.length - 1];

                    return {
                        nome,
                        differenza:n(last.punteggio) - n(first.punteggio),
                        primo:n(first.punteggio),
                        ultimo:n(last.punteggio),
                        count:items.length
                    };
                })
                .sort((a,b)=>b.differenza-a.differenza);

            const m1 = media(prima,x=>n(x.punteggio));
            const m2 = media(seconda,x=>n(x.punteggio));
            const p1 = media(prima,x=>puntiFrecciaAnalytics(x));
            const p2 = media(seconda,x=>puntiFrecciaAnalytics(x));

            return {
                eventi:tutte.length,
                media_prima:Number(m1.toFixed(1)),
                media_seconda:Number(m2.toFixed(1)),
                differenza_media:Number((m2-m1).toFixed(1)),
                ppf_prima:Number(p1.toFixed(2)),
                ppf_seconda:Number(p2.toFixed(2)),
                differenza_ppf:Number((p2-p1).toFixed(2)),
                migliori_trend:trend.filter(t => t.differenza > 0).slice(0,5),
                peggiori_trend:trend.filter(t => t.differenza < 0).sort((a,b)=>a.differenza-b.differenza).slice(0,5)
            };
        }

        res.json({
            eventi:gare.length + allenamenti.length,
            gare:calcolaProgressiSet(gare),
            allenamenti:calcolaProgressiSet(allenamenti),
            totale:calcolaProgressiSet([...gare,...allenamenti])
        });
    }catch(err){
        res.status(500).json({ success:false, error:err.message });
    }
});



function dbGetFilter(sql,params=[]){
    return new Promise(resolve=>db.get(sql,params,(err,row)=>resolve(err?null:(row||null))));
}
function dbAllFilter(sql,params=[]){
    return new Promise(resolve=>db.all(sql,params,(err,rows)=>resolve(err?[]:(rows||[]))));
}

function mediaConfronto(values){
    return values.length ? values.reduce((s,v)=>s+Number(v||0),0)/values.length : 0;
}
function posConfronto(items,id,score){
    const ord=items.slice().sort((a,b)=>Number(b.punteggio||0)-Number(a.punteggio||0));
    const i=ord.findIndex(x=>String(x.id)===String(id));
    return i>=0 ? i+1 : ord.length+1;
}
function msgConfronto(pos,d1,d5){
    if(pos===1) return "🥇 Nuovo record personale per questa categoria";
    if(pos===2) return "🥈 Secondo miglior risultato personale";
    if(d1>0&&d5>0) return "📈 Sopra la media generale e sopra la media degli ultimi 5";
    if(d1>0) return "📈 Sopra la tua media generale";
    if(d5>0) return "📈 Sopra la media degli ultimi 5";
    if(d1<0) return "📉 Sotto la tua media personale";
    return "Risultato in linea con la tua media";
}
app.get("/api/confronto/gara/:id", async (req,res) => {
    const id=req.params.id;
    const current=await dbGetFilter("SELECT * FROM gare WHERE id=? AND user_id=?",[id,req.user.id]);
    if(!current) return res.status(404).json({success:false,message:"Gara non trovata"});
    const all=await dbAllFilter("SELECT * FROM gare WHERE user_id=? ORDER BY data ASC,id ASC",[req.user.id]);
    const key=[current.tipo_gara||"",current.tipo_arco||"",current.distanza||""].join("|");
    const gruppo=all.filter(g=>[g.tipo_gara||"",g.tipo_arco||"",g.distanza||""].join("|")===key);
    const prec=gruppo.filter(g=>String(g.id)!==String(id));
    const ultimi5=prec.slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||""))||Number(b.id)-Number(a.id)).slice(0,5);
    const score=Number(current.punteggio||0);
    const mg=mediaConfronto(prec.map(g=>g.punteggio));
    const m5=mediaConfronto(ultimi5.map(g=>g.punteggio));
    const pos=posConfronto(gruppo,id,score);
    res.json({success:true,confronto:{
        kind:"gara",id:Number(id),punteggio:score,totale_risultati:gruppo.length,risultati_precedenti:prec.length,
        categoria:{tipo:current.tipo_gara||"",arco:current.tipo_arco||"",distanza:current.distanza||"",label:[current.tipo_gara,current.tipo_arco,current.distanza?current.distanza+"m":""].filter(Boolean).join(" · ")},
        media_generale:Number(mg.toFixed(1)),media_ultimi_5:Number(m5.toFixed(1)),
        differenza_media:Number((score-mg).toFixed(1)),differenza_ultimi_5:Number((score-m5).toFixed(1)),
        posizione:pos,messaggio:msgConfronto(pos,score-mg,score-m5)
    }});
});
app.get("/api/confronto/allenamento/:id", async (req,res) => {
    const id=req.params.id;
    const current=await dbGetFilter("SELECT * FROM allenamenti WHERE id=? AND user_id=?",[id,req.user.id]);
    if(!current) return res.status(404).json({success:false,message:"Allenamento non trovato"});
    const all=await dbAllFilter("SELECT * FROM allenamenti WHERE user_id=? ORDER BY data ASC,id ASC",[req.user.id]);
    const key=[current.tipo_allenamento||"",current.tipo_arco||"",current.distanza||"",current.piazzole||""].join("|");
    const gruppo=all.filter(a=>[a.tipo_allenamento||"",a.tipo_arco||"",a.distanza||"",a.piazzole||""].join("|")===key);
    const prec=gruppo.filter(a=>String(a.id)!==String(id));
    const ultimi5=prec.slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||""))||Number(b.id)-Number(a.id)).slice(0,5);
    const score=Number(current.punteggio||0);
    const mg=mediaConfronto(prec.map(a=>a.punteggio));
    const m5=mediaConfronto(ultimi5.map(a=>a.punteggio));
    const pos=posConfronto(gruppo,id,score);
    res.json({success:true,confronto:{
        kind:"allenamento",id:Number(id),punteggio:score,totale_risultati:gruppo.length,risultati_precedenti:prec.length,
        categoria:{tipo:current.tipo_allenamento||"",arco:current.tipo_arco||"",distanza:current.distanza||"",piazzole:current.piazzole||"",label:[current.tipo_allenamento,current.tipo_arco,current.distanza?current.distanza+"m":"",current.piazzole?current.piazzole+" piazzole":""].filter(Boolean).join(" · ")},
        media_generale:Number(mg.toFixed(1)),media_ultimi_5:Number(m5.toFixed(1)),
        differenza_media:Number((score-mg).toFixed(1)),differenza_ultimi_5:Number((score-m5).toFixed(1)),
        posizione:pos,messaggio:msgConfronto(pos,score-mg,score-m5)
    }});
});

// =======================
// VALORI / EVOLUZIONE / BADGE / MAPPA EXTRA
// =======================

function dbAllExtra(sql,params=[]){
    return new Promise(resolve => {
        db.all(sql,params,(err,rows) => {
            if(err){
                console.error("SQL extra:",err.message);
                resolve([]);
            }else{
                resolve(rows || []);
            }
        });
    });
}

function normalizzaValoreScore(v){
    return String(v || "").trim().toUpperCase() || "VUOTO";
}

function meseLabel(data){
    const s = String(data || "");
    return s.length >= 7 ? s.slice(0,7) : "Senza data";
}

function annoFilterSql(alias,anno){
    if(!anno || anno === "all") return { where:"", params:[] };
    return { where:` AND substr(${alias}.data,1,4) = ? `, params:[anno] };
}

function estraiProvinciaLuogo(luogo){
    const m = String(luogo || "").match(/\(([A-Z]{2})\)/);
    return m ? m[1] : "";
}

const REGIONI_DA_PROVINCIA = {
    "AG":"Sicilia","AL":"Piemonte","AN":"Marche","AO":"Valle d'Aosta","AR":"Toscana","AP":"Marche","AT":"Piemonte","AV":"Campania",
    "BA":"Puglia","BT":"Puglia","BL":"Veneto","BN":"Campania","BG":"Lombardia","BI":"Piemonte","BO":"Emilia-Romagna","BZ":"Trentino-Alto Adige","BS":"Lombardia","BR":"Puglia",
    "CA":"Sardegna","CL":"Sicilia","CB":"Molise","CI":"Sardegna","CE":"Campania","CT":"Sicilia","CZ":"Calabria","CH":"Abruzzo","CO":"Lombardia","CS":"Calabria","CR":"Lombardia","KR":"Calabria","CN":"Piemonte",
    "EN":"Sicilia","FM":"Marche","FE":"Emilia-Romagna","FI":"Toscana","FG":"Puglia","FC":"Emilia-Romagna","FR":"Lazio",
    "GE":"Liguria","GO":"Friuli-Venezia Giulia","GR":"Toscana",
    "IM":"Liguria","IS":"Molise","SP":"Liguria","AQ":"Abruzzo","LT":"Lazio","LE":"Puglia","LC":"Lombardia","LI":"Toscana","LO":"Lombardia","LU":"Toscana",
    "MC":"Marche","MN":"Lombardia","MS":"Toscana","MT":"Basilicata","ME":"Sicilia","MI":"Lombardia","MO":"Emilia-Romagna","MB":"Lombardia",
    "NA":"Campania","NO":"Piemonte","NU":"Sardegna","OR":"Sardegna","PD":"Veneto","PA":"Sicilia","PR":"Emilia-Romagna","PV":"Lombardia","PG":"Umbria","PU":"Marche","PE":"Abruzzo","PC":"Emilia-Romagna","PI":"Toscana","PT":"Toscana","PN":"Friuli-Venezia Giulia","PZ":"Basilicata","PO":"Toscana",
    "RG":"Sicilia","RA":"Emilia-Romagna","RC":"Calabria","RE":"Emilia-Romagna","RI":"Lazio","RN":"Emilia-Romagna","RM":"Lazio","RO":"Veneto",
    "SA":"Campania","SS":"Sardegna","SV":"Liguria","SI":"Toscana","SR":"Sicilia","SO":"Lombardia","SU":"Sardegna",
    "TA":"Puglia","TE":"Abruzzo","TR":"Umbria","TO":"Piemonte","TP":"Sicilia","TN":"Trentino-Alto Adige","TV":"Veneto","TS":"Friuli-Venezia Giulia",
    "UD":"Friuli-Venezia Giulia","VA":"Lombardia","VE":"Veneto","VB":"Piemonte","VC":"Piemonte","VR":"Veneto","VV":"Calabria","VI":"Veneto","VT":"Lazio"
};

app.get("/api/statistiche/valori", async (req,res) => {
    const anno = req.query.anno || "all";
    const fG = annoFilterSql("g",anno);
    const fA = annoFilterSql("a",anno);

    const gare = await dbAllExtra(`
        SELECT g.id,g.data,g.tipo_gara AS tipo,g.tipo_arco,g.distanza,se.valore
        FROM gare g
        JOIN score_entries se ON se.gara_id = g.id
        WHERE g.user_id = ? ${fG.where}
    `, [req.user.id, ...fG.params]);

    const allenamenti = await dbAllExtra(`
        SELECT a.id,a.data,a.tipo_allenamento AS tipo,a.tipo_arco,a.distanza,a.piazzole,se.valore
        FROM allenamenti a
        JOIN allenamento_score_entries se ON se.allenamento_id = a.id
        WHERE a.user_id = ? ${fA.where}
    `, [req.user.id, ...fA.params]);

    function distribuzione(rows){
        const counts = {};
        rows.forEach(r => {
            const v = normalizzaValoreScore(r.valore);
            counts[v] = (counts[v] || 0) + 1;
        });

        const totale = Object.values(counts).reduce((s,v)=>s+v,0);

        return Object.entries(counts)
            .map(([valore,count]) => ({
                valore,
                count,
                percentuale:totale ? Number(((count / totale) * 100).toFixed(1)) : 0
            }))
            .sort((a,b) => {
                const order = {"X":99,"11":98,"10":97,"9":96,"8":95,"7":94,"6":93,"5":92,"4":91,"3":90,"2":89,"1":88,"M":0};
                return (order[b.valore] ?? Number(b.valore) ?? 0) - (order[a.valore] ?? Number(a.valore) ?? 0);
            });
    }

    function gruppi(rows,kind){
        const map = {};
        rows.forEach(r => {
            const key = [
                r.tipo || kind,
                r.tipo_arco || "",
                r.distanza || "",
                r.piazzole || ""
            ].join("|");

            if(!map[key]){
                map[key] = {
                    kind,
                    label:[
                        r.tipo || kind,
                        r.tipo_arco,
                        r.distanza ? r.distanza + "m" : "",
                        r.piazzole ? r.piazzole + " piazzole" : ""
                    ].filter(Boolean).join(" · "),
                    rows:[]
                };
            }

            map[key].rows.push(r);
        });

        return Object.values(map).map(g => ({
            kind:g.kind,
            label:g.label,
            distribuzione:distribuzione(g.rows),
            totale:g.rows.length
        })).sort((a,b)=>b.totale-a.totale);
    }

    res.json({
        anno,
        gare:{
            totale:gare.length,
            distribuzione:distribuzione(gare),
            gruppi:gruppi(gare,"gare")
        },
        allenamenti:{
            totale:allenamenti.length,
            distribuzione:distribuzione(allenamenti),
            gruppi:gruppi(allenamenti,"allenamenti")
        }
    });
});

app.get("/api/statistiche/evoluzione", async (req,res) => {
    const anno = req.query.anno || "all";
    const fG = annoFilterSql("g",anno);
    const fA = annoFilterSql("a",anno);

    const gare = await dbAllExtra(`SELECT 'gara' AS kind, data, punteggio FROM gare g WHERE 1=1 ${fG.where}`, fG.params);
    const allenamenti = await dbAllExtra(`SELECT 'allenamento' AS kind, data, punteggio FROM allenamenti a WHERE 1=1 ${fA.where}`, fA.params);

    function calc(rows){
        const map = {};
        rows.forEach(r => {
            const m = meseLabel(r.data);
            if(!map[m]) map[m] = { mese:m, count:0, totale:0, migliore:0 };
            map[m].count++;
            map[m].totale += Number(r.punteggio || 0);
            map[m].migliore = Math.max(map[m].migliore, Number(r.punteggio || 0));
        });

        return Object.values(map)
            .sort((a,b)=>a.mese.localeCompare(b.mese))
            .map(x => ({
                mese:x.mese,
                count:x.count,
                media:Number((x.totale / x.count).toFixed(1)),
                migliore:x.migliore
            }));
    }

    res.json({
        anno,
        gare:calc(gare),
        allenamenti:calc(allenamenti),
        totale:calc([...gare,...allenamenti])
    });
});

app.get("/api/badge", async (req,res) => {
    const gare = await dbAllExtra("SELECT * FROM gare WHERE user_id = ? ORDER BY data ASC, id ASC",[req.user.id]);
    const allenamenti = await dbAllExtra("SELECT * FROM allenamenti WHERE user_id = ? ORDER BY data ASC, id ASC",[req.user.id]);

    function creaBadge(rows,kind){
        const out = [];
        const labelKind = kind === "gara" ? "Gare" : "Allenamenti";
        const singular = kind === "gara" ? "gara" : "allenamento";

        const sorted = rows.filter(r => r.data).sort((a,b)=>String(a.data).localeCompare(String(b.data)) || Number(a.id)-Number(b.id));

        [1,5,10,25,50,100].forEach(n => {
            if(sorted.length >= n){
                out.push({
                    kind,
                    titolo:`${n} ${n === 1 ? singular : labelKind.toLowerCase()}`,
                    descrizione:`Hai salvato ${n} ${n === 1 ? singular : labelKind.toLowerCase()}`,
                    icona:n === 1 ? "🎯" : "🏹",
                    data:sorted[n-1].data
                });
            }
        });

        [500,550,600,650,700].forEach(soglia => {
            const r = sorted.find(x => Number(x.punteggio || 0) >= soglia);
            if(r){
                out.push({
                    kind,
                    titolo:`Primo ${soglia}`,
                    descrizione:`Primo risultato da almeno ${soglia} punti`,
                    icona:"🏅",
                    data:r.data,
                    punteggio:Number(r.punteggio || 0)
                });
            }
        });

        const best = sorted.slice().sort((a,b)=>Number(b.punteggio||0)-Number(a.punteggio||0))[0];
        if(best){
            out.push({
                kind,
                titolo:`Record ${kind === "gara" ? "gare" : "allenamenti"}`,
                descrizione:`Miglior punteggio salvato: ${best.punteggio}`,
                icona:"🥇",
                data:best.data,
                punteggio:Number(best.punteggio || 0)
            });
        }

        return out;
    }

    const all = [
        ...creaBadge(gare,"gara"),
        ...creaBadge(allenamenti,"allenamento")
    ].sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")));

    res.json({
        gare:all.filter(x=>x.kind==="gara"),
        allenamenti:all.filter(x=>x.kind==="allenamento"),
        tutti:all
    });
});

app.get("/api/mappa/statistiche", async (req,res) => {
    const anno = String(req.query.anno || "all");

    const allRows = await dbAllExtra("SELECT data, luogo FROM gare WHERE user_id = ? AND luogo IS NOT NULL AND luogo <> ''",[req.user.id]);

    const anni = [...new Set(
        allRows
            .map(r => String(r.data || "").slice(0,4))
            .filter(Boolean)
    )].sort((a,b)=>Number(b)-Number(a));

    const rows = anno === "all"
        ? allRows
        : allRows.filter(r => String(r.data || "").startsWith(anno));

    const localita = {};
    const province = {};
    const regioni = {};

    rows.forEach(g => {
        const luogo = String(g.luogo || "").trim();
        if(!luogo) return;

        localita[luogo] = (localita[luogo] || 0) + 1;

        const prov = estraiProvinciaLuogo(luogo);
        if(!prov) return;

        province[prov] = (province[prov] || 0) + 1;

        const reg = REGIONI_DA_PROVINCIA[prov] || "Non riconosciuta";
        regioni[reg] = (regioni[reg] || 0) + 1;
    });

    res.json({
        anno,
        anni,
        localita:Object.entries(localita).map(([nome,count])=>({nome,count})).sort((a,b)=>a.nome.localeCompare(b.nome)),
        province:Object.entries(province).map(([nome,count])=>({nome,count})).sort((a,b)=>a.nome.localeCompare(b.nome)),
        regioni:Object.entries(regioni).map(([nome,count])=>({nome,count})).sort((a,b)=>a.nome.localeCompare(b.nome)),
        localita_count:Object.keys(localita).length,
        province_count:Object.keys(province).length,
        regioni_count:Object.keys(regioni).length
    });
});



// =======================
// BACKUP / IMPORT DATI UTENTE
// =======================
app.get("/api/backup/miei-dati", async (req,res) => {
    const gare = await dbAllSafe("SELECT * FROM gare WHERE user_id = ? ORDER BY data ASC,id ASC",[req.user.id]);
    const allenamenti = await dbAllSafe("SELECT * FROM allenamenti WHERE user_id = ? ORDER BY data ASC,id ASC",[req.user.id]);

    for(const gara of gare){
        gara.score = await dbAllSafe("SELECT serie,volee,freccia,valore FROM score_entries WHERE gara_id = ? ORDER BY serie,volee,freccia",[gara.id]);
        delete gara.user_id;
    }

    for(const a of allenamenti){
        a.score = await dbAllSafe("SELECT serie,volee,freccia,valore FROM allenamento_score_entries WHERE allenamento_id = ? ORDER BY serie,volee,freccia",[a.id]);
        delete a.user_id;
    }

    res.setHeader("Content-Disposition","attachment; filename=archeryscore_miei_dati.json");
    res.json({ version:1, exported_at:new Date().toISOString(), user:req.user.username, gare, allenamenti });
});


function trovaGaraDuplicata(userId,g){
    return new Promise(resolve=>db.get(`SELECT id FROM gare WHERE user_id=? AND COALESCE(codice_gara,'')=? AND COALESCE(nome,'')=? AND COALESCE(data,'')=? AND COALESCE(luogo,'')=? AND COALESCE(tipo_gara,'')=? AND COALESCE(tipo_arco,'')=? AND COALESCE(distanza,'')=? AND COALESCE(punteggio,0)=? LIMIT 1`,
    [userId,g.codice_gara||"",g.nome||"",g.data||"",g.luogo||"",g.tipo_gara||"",g.tipo_arco||"",g.distanza||"",Number(g.punteggio||0)],(e,r)=>resolve(r||null)));
}
function trovaAllenamentoDuplicato(userId,a){
    return new Promise(resolve=>db.get(`SELECT id FROM allenamenti WHERE user_id=? AND COALESCE(data,'')=? AND COALESCE(tipo_arco,'')=? AND COALESCE(tipo_allenamento,'')=? AND COALESCE(distanza,'')=? AND COALESCE(piazzole,'')=? AND COALESCE(punteggio,0)=? LIMIT 1`,
    [userId,a.data||"",a.tipo_arco||"",a.tipo_allenamento||"",a.distanza||"",a.piazzole||"",Number(a.punteggio||0)],(e,r)=>resolve(r||null)));
}
async function cleanupDuplicatiUtente(userId){
    const gare=await dbAllSafe("SELECT * FROM gare WHERE user_id=? ORDER BY id ASC",[userId]);
    const seen=new Set();
    for(const g of gare){
        const k=[g.codice_gara||"",g.nome||"",g.data||"",g.luogo||"",g.tipo_gara||"",g.tipo_arco||"",g.distanza||"",g.punteggio||0].join("|");
        if(seen.has(k)){
            await new Promise(r=>db.run("DELETE FROM score_entries WHERE gara_id=?",[g.id],()=>r()));
            await new Promise(r=>db.run("DELETE FROM gare WHERE id=? AND user_id=?",[g.id,userId],()=>r()));
        }else seen.add(k);
    }
    const all=await dbAllSafe("SELECT * FROM allenamenti WHERE user_id=? ORDER BY id ASC",[userId]);
    const seenA=new Set();
    for(const a of all){
        const k=[a.data||"",a.tipo_arco||"",a.tipo_allenamento||"",a.distanza||"",a.piazzole||"",a.punteggio||0].join("|");
        if(seenA.has(k)){
            await new Promise(r=>db.run("DELETE FROM allenamento_score_entries WHERE allenamento_id=?",[a.id],()=>r()));
            await new Promise(r=>db.run("DELETE FROM allenamenti WHERE id=? AND user_id=?",[a.id,userId],()=>r()));
        }else seenA.add(k);
    }
}
app.post("/api/import/miei-dati", async (req,res) => {
    const data = req.body || {};
    const gare = Array.isArray(data.gare) ? data.gare : [];
    const allenamenti = Array.isArray(data.allenamenti) ? data.allenamenti : [];

    function runAsync(sql,params=[]){
        return new Promise((resolve,reject) => db.run(sql,params,function(err){ err ? reject(err) : resolve(this); }));
    }

    try{
        let gCount = 0;
        let aCount = 0;

        for(const g of gare){
            if(await trovaGaraDuplicata(req.user.id,g)) continue;
            const r = await runAsync(`
                INSERT INTO gare(
                    user_id,codice_gara,nome,data,luogo,indirizzo,lat,lng,
                    tipo_gara,tipo_arco,distanza,punteggio,
                    x_count,ten_count,eleven_count,nine_count,five_count,miss_count
                )
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `,[
                req.user.id,g.codice_gara||"",g.nome||"",g.data||"",g.luogo||"",g.indirizzo||"",g.lat||null,g.lng||null,
                g.tipo_gara||"",g.tipo_arco||"",g.distanza||null,g.punteggio||0,
                g.x_count||0,g.ten_count||0,g.eleven_count||0,g.nine_count||0,g.five_count||0,g.miss_count||0
            ]);
            await new Promise((resolve,reject) => salvaScore(r.lastID,g.score||[],resolve,reject));
            gCount++;
        }

        for(const a of allenamenti){
            if(await trovaAllenamentoDuplicato(req.user.id,a)) continue;
            const r = await runAsync(`
                INSERT INTO allenamenti(
                    user_id,data,tipo_arco,tipo_allenamento,distanza,piazzole,punteggio,
                    x_count,ten_count,eleven_count,nine_count,six_count,five_count,miss_count
                )
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `,[
                req.user.id,a.data||"",a.tipo_arco||"",a.tipo_allenamento||"",a.distanza||null,a.piazzole||null,a.punteggio||0,
                a.x_count||0,a.ten_count||0,a.eleven_count||0,a.nine_count||0,a.six_count||0,a.five_count||0,a.miss_count||0
            ]);
            await new Promise((resolve,reject) => salvaScoreAllenamento(r.lastID,a.score||[],resolve,reject));
            aCount++;
        }

        res.json({ success:true, gare:gCount, allenamenti:aCount });
    }catch(err){
        res.status(500).json({ success:false, error:err.message });
    }
});


app.post("/api/cleanup/duplicati-miei", async (req,res)=>{try{await cleanupDuplicatiUtente(req.user.id);res.json({success:true});}catch(err){res.status(500).json({success:false,error:err.message});}});

app.get("/api/backup/database", (req,res) => {
    const dbPath =
    path.join(__dirname,"data","gare.sqlite");

    if(!fs.existsSync(dbPath)){
        return res.status(404).send("Database non trovato");
    }

    res.download(dbPath,"backup_archeryscore.sqlite");
});

app.listen(3001, () => {
    console.log("");
    console.log("ARCHERY SCORE");
    console.log("http://localhost:3001");
    console.log("");
});