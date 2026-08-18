import express from "express";
import path from "path";
import bcrypt from "bcrypt";
import session from "express-session";
import upload from "./upload.js";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const salt = 10;

app.use(express.static("public"));
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.use(
  session({
    secret: process.env.SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 7,
      sameSite: "lax"
    },
  })
);



const { Pool } = pg;

const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect()
  .then(() => console.log("PostgreSQL connected"))
  .catch((err) => console.error("DB error:", err));



async function allPosts() {
  try {
    const result = await db.query(
      "SELECT * FROM POST ORDER BY ID_POST DESC"
    );

    return result.rows;
  } catch (err) {
    console.log(err);
    return [];
  }
}


function verifAuth(req, res, next) {
  if (!req.session.user) {
    req.session.message =
      "Veuillez vous connecter afin d’accéder aux publications";
      req.session.returnTo = req.originalUrl; // ← sauvegarde AVANT la redirection
    return res.redirect("/connecter");
  }
  req.session.returnTo = req.originalUrl;
  next();
}
function verifAuthAdmin(req, res, next) {
  if (!req.session.user || req.session.user.is_admin !== 1) {
    req.session.message =
      "Vous n'etes pas un admnistrateur";
    if (req.method === "GET") {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect("/connecter");
  }
  next();
}

app.get("/", (req, res) => {
  res.render("pages/accueil.ejs");
});

app.get("/accueil", (req, res) => {
  res.redirect("/");
});

app.get("/enregistrer", (req, res) => {
  res.render("pages/enregistrer");
});

app.post("/enregistrer", async (req, res) => {
  try {
    const { nom, prenom, email, password, confirm_password } = req.body;
    console.log(nom);
    console.log(prenom);
    console.log(email);
    console.log(password);
    console.log(confirm_password)

    if (password !== confirm_password) {
      return res.render("pages/enregistrer", {
        message: "Veuillez entrer les mêmes mots de passe",
      });
    }

    const password_hash = await bcrypt.hash(password, 10); // 10 = salt rounds

    console.log(password_hash)



    await db.query(
      `
      INSERT INTO MEMBRE (NOM, PRENOM, EMAIL, PASSWORD)
      VALUES ($1, $2, $3, $4)
      `,
      [nom, prenom, email, password_hash]
    );
    return res.redirect("/connecter");
  } catch (err) {
    console.log(err.message);
    return res.render("pages/enregistrer", {
      message: "Erreur lors de l'enregistrement",
    });
  }
});

app.get("/connecter", (req, res) => {
  const message = req.session.message || null;
  delete req.session.message;
  res.render("pages/connecter", { message });
});

app.post("/connecter", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query(
      `SELECT * FROM membre WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      req.session.message = "Utilisateur non trouvé";
      return res.redirect("/connecter");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      req.session.message = "Mot de passe incorrect";
      return res.redirect("/connecter");
    }

    req.session.user = user;

    const redirectTo = req.session.returnTo || "/";
    delete req.session.returnTo;

    return res.redirect(redirectTo);

  } catch (err) {
    console.log("ERREUR LOGIN :", err);
    req.session.message = "Erreur serveur";
    return res.redirect("/connecter");
  }
});


app.get("/Nouveau_post", verifAuthAdmin, async (req, res) => {
  const posts = await allPosts();
  res.render("pages/Nouveau_post", { posts });
});

app.post("/Nouveau_post", async (req, res) => {

  try {
    const { titre, accroche, date } = req.body;

    await db.query(
      `
      INSERT INTO post (titre, accroche, date_post)
      VALUES ($1, $2, $3)
      `,
      [titre, accroche, date]
    );


    const posts = await allPosts();


    

    return res.render("pages/Nouveau_post", { posts });


  } catch (err) {
    console.log("ERREUR INSERT POST :", err);
    return res.status(500).send("Erreur serveur");
  }
});


app.post("/nouveau_comment", async (req, res) => {
  try {
    const { post_choisi, paragraph, date } = req.body;

    const id_post = parseInt(post_choisi);

    await db.query(
      `
      INSERT INTO paragraph (id_post, contenu_p, date_creation_p)
      VALUES ($1, $2, $3)
      `,
      [id_post, paragraph, date]
    );

    res.redirect("/Nouveau_post");

  } catch (err) {
    console.log(err);
    res.status(500).send("Erreur d'insertion du paragraphe");
  }
});

app.post("/nouveau_file", upload.single("file"), async (req, res) => {
  try {
    const id_post = parseInt(req.body.post_choisi);
    const file = req.file.originalname;
    const date = req.body.date;

    await db.query(
      `
      INSERT INTO file (id_post, contenu_f, date_creation_f)
      VALUES ($1, $2, $3)
      `,
      [id_post, file, date]
    );

    res.redirect("/Nouveau_post");

  } catch (err) {
    console.log(err);
    res.status(500).send("Erreur d'insertion du fichier");
  }
});


app.get("/posts", verifAuth, async (req, res) => {
  const posts = await allPosts();

  res.render("pages/Posts", { posts });
});

app.get("/posts/:id", verifAuth, async (req, res) => {
  try {
    const id_post = parseInt(req.params.id);

    const show = Number(req.session.user.is_admin) === 1;

    const paragraphesRes = await db.query(
      `SELECT * FROM paragraph WHERE id_post = $1`,
      [id_post]
    );

    const filesRes = await db.query(
      `SELECT * FROM file WHERE id_post = $1`,
      [id_post]
    );

    const postRes = await db.query(
      `SELECT * FROM post WHERE id_post = $1`,
      [id_post]
    );

    const result_commentaire = await db.query(`SELECT * FROM commentaires where id_post= $1`,[id_post]);
    const result2 = result_commentaire.rows;

    const paragraphes = paragraphesRes.rows;
    const files = filesRes.rows;
    const row = postRes.rows[0];

    if (!row) {
      return res.status(404).send("Post introuvable");
    }

    const contenu = [
      ...paragraphes.map(p => ({
        type: "paragraph",
        id: p.id_paragraph,
        date: p.date_creation_p,
        content: p.contenu_p
      })),
      ...files.map(f => ({
        type: "file",
        id: f.id_file,
        date: f.date_creation_f,
        content: f.contenu_f
      })),
    ];

    contenu.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.render("pages/post_details", {
      id_selected: id_post,
      MonTitre: row.titre,
      contenu,
      commentaires:result2,
      show
    });

  } catch (err) {
    console.log("ERREUR POST DETAIL:", err);
    res.status(500).send("Erreur serveur");
  }
});

app.post("/update/:id", verifAuthAdmin, upload.single("new_file"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const new_paragraph = req.body.new_paragraph || null;
    const new_file = req.file ? req.file.originalname : null;

    if (new_paragraph) {

      await db.query(
        `UPDATE paragraph
         SET contenu_p = $1
         WHERE id_paragraph = $2`,
        [new_paragraph, id]
      );

      const result = await db.query(
        `SELECT id_post
         FROM paragraph
         WHERE id_paragraph = $1`,
        [id]
      );

      res.redirect(`/posts/${result.rows[0].id_post}`);

    } else if (new_file) {

      await db.query(
        `UPDATE file
         SET contenu_f = $1
         WHERE id_file = $2`,
        [new_file, id]
      );

      const result = await db.query(
        `SELECT id_post
         FROM file
         WHERE id_file = $1`,
        [id]
      );

      res.redirect(`/posts/${result.rows[0].id_post}`);

    } else {
      res.status(400).send("Aucune donnée reçue");
    }

  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

app.post("/delete_post/:id", verifAuthAdmin, async (req, res) => {
  const id = req.params.id;

  try {
    await db.query(`DELETE FROM PARAGRAPH WHERE ID_POST = $1`, [id]);
    await db.query(`DELETE FROM FILE WHERE ID_POST = $1`, [id]);
    await db.query(`DELETE FROM POST WHERE ID_POST = $1`, [id]);

    res.redirect("/posts");
  } catch (err) {
    console.log(err);
    return res.status(404).send("Erreur de suppression");
  }
});

app.get("/resume/:id", (req, res)=>{
  const id = parseInt(req.params.id)

  res.redirect(`/posts/${id}`)
});

app.post('/resume/:id', async (req, res) => {
    const id = parseInt(req.params.id);

    try {
        // Récupérer les paragraphes
        const { rows } = await db.query(
            `SELECT * FROM PARAGRAPH WHERE ID_POST = $1`,
            [id]
        );

        const texteComplet = rows.map(row => row.contenu_p).join('\n\n');

        // Appel IA
        let titreIA = "Erreur : L'IA ne répond pas";
        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "qwen3.5:2b",
                    prompt: `Analyze the following text. Reply ONLY in this exact format, no polite phrases:
Catégorie : [text type: example biology, economy, etc] | Titre : [your title maximum 10 words] | Resume: [200 words max, 80 words min]
IMPORTANT: Write the Catégorie, Titre and Resume in the SAME language as the text below.
Text to analyze: ${texteComplet}`,
                    stream: false,
                    think:false
                })
            });
            const data = await response.json();
            titreIA = data.response;
        } catch (error) {
            console.error("Erreur IA :", error);
        }

        // Récupérer les fichiers et le post en parallèle
        const [filesResult, postResult, commentairesResult] = await Promise.all([
            db.query(`SELECT * FROM FILE WHERE ID_POST = $1`, [id]),
            db.query(`SELECT * FROM POST WHERE ID_POST = $1`, [id]),
            db.query(`SELECT * FROM commentaires  WHERE ID_POST = $1`, [id])
        ]);

        const files = filesResult.rows;
        const post  = postResult.rows[0];
        const commentaires = commentairesResult.rows;

        if (!post) return res.status(404).send("Post introuvable");

        const show = req.session.user && req.session.user.is_admin === 1 ? "show" : null;

        const contenu = [
            ...rows.map(p => ({ type: "paragraph", id: p.id_paragraph, date: p.date_creation_p, content: p.contenu_p })),
            ...files.map(f => ({ type: "file",      id: f.id_file,      date: f.date_creation_f, content: f.contenu_f })),
        ];
        contenu.sort((a, b) => new Date(a.date) - new Date(b.date));

        res.render("pages/post_details", {
            id_selected: id,
            MonTitre: post.titre,
            contenu,
            commentaires,
            show,
            titreIA
        });

    } catch (err) {
        console.error("Erreur DB :", err);
        res.status(500).send("Erreur serveur");
    }
});




app.post("/commentaires/:id_selected", async (req, res) => {
  const id = parseInt(req.params.id_selected);
  if (isNaN(id)) return res.status(400).send("ID invalide");

  const { nom, prenom, commentaire } = req.body;

  try {
    const responseIA = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:latest",
        stream: false,
        temperature: 0,         // ← déterministe, pas de créativité
        messages: [
          {
            role: "system",
            content: `Tu es un modérateur strict. 
Tu analyses des commentaires pour détecter : insultes, harcèlement, spam, mots de passe ou clés d'API.
Tu réponds UNIQUEMENT par un seul mot en majuscules : REJET ou APPROUVÉ.
Aucune explication. Aucune phrase. Un seul mot.`
          },
          {
            role: "user",
            content: commentaire
          }
        ]
      })
    });

    const data = await responseIA.json();

    if (!responseIA.ok || data.error) {
      console.error("Ollama error:", data.error ?? responseIA.status);
      throw new Error("Modération IA indisponible");
    }

    const rawText = data.message?.content ?? "";
    console.log("Réponse brute Ollama:", JSON.stringify(rawText));

    // Nettoyer et extraire le dernier mot (sécurité supplémentaire)
    const cleanedText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const words = cleanedText.split(/\s+/).filter(Boolean);
    const decision = (words[words.length - 1] ?? "").toUpperCase();

    console.log("Décision extraite:", decision);

    if (decision === "REJET") {
      return res.status(400).send("Votre commentaire a été bloqué par le modérateur IA (contenu inapproprié ou données sensibles détectées).");
    }

    // Si le modèle ne répond pas APPROUVÉ non plus → bloquer par défaut
    if (decision !== "APPROUVÉ" && decision !== "APPROUVE") {
      console.warn("Réponse inattendue du modèle:", decision);
      return res.status(400).send("Modération impossible : réponse inattendue du modèle IA.");
    }

    await db.query(
      `INSERT INTO commentaires(nom, prenom, contenu, id_post) VALUES($1, $2, $3, $4)`,
      [nom, prenom, commentaire, id]
    );

    res.redirect(`/posts/${id}`);

  } catch (err) {
    console.error(err);
    return res.status(500).send("Erreur dans l'insertion des commentaires");
  }
});


app.post("/reponse_commentaire/:id_commentaire", (req, res)=>{
  const id_commentaire = parseInt( req.params.id_commentaire);
  console.log(id_commentaire)

})





app.get("/CV", (req, res) => {
  res.render("CV/cv");
});
app.get("/CV/en", (req, res) => {
  res.render("CV/cv_en");
});

app.listen(port, () => {
  console.log(`Le serveur marche sur ${port}`);
});
