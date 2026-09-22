import express from "express";
import path from "path";
import fs from "fs";
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
const port = process.env.PORT || 3000;
const salt = 10;

app.use(express.static("public"));
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("trust proxy", true); // add this once, near your app setup

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

let db;

if (process.env.ISDEVELOPMENT === "true") {

  db = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
  });

} else {

  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

}

db.connect()
  .then(() => console.log("✅ PostgreSQL connected"))
  .catch((err) => console.error("❌ DB error:", err));


export default db;


async function startServer() {
  try {
    await db.connect();
    console.log("PostgreSQL connected");
  } catch (err) {
    console.error("DB connection error:", err);
    process.exit(1);
  }

  // Initialize database schema
  try {
    const sql = fs.readFileSync(path.join(__dirname, "database.sql"), "utf8");
    await db.query(sql);
    console.log("Database schema initialized");
  } catch (err) {
    console.error("Error initializing database:", err);
  }

  app.listen(port, () => {
    console.log(`Le serveur marche sur ${port}`);
  });
}

startServer();



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
console.log("FICHIER SERVEUR CHARGÉ");


app.get("/", async (req, res) => {
  const currentIp = req.ip;
  let dataMeteo = null;
  console.log("Current IP:", currentIp);
  // 70.82.41.209
  try {
    const response = await fetch(
      `https://api.ipwho.org/ip/${currentIp}?apiKey=${process.env.API_KEY_IP}`
    );
    const dataIP = await response.json();

    if (!dataIP?.data?.geoLocation) {
      throw new Error("Invalid IP geolocation response");
    }

    const { city: ville, latitude: lat, longitude: lon } = dataIP.data.geoLocation;

    const meteo = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,relative_humidity_2m`
    );
    const result_meteo = await meteo.json();

    if (!result_meteo?.current) {
      throw new Error("Invalid weather response");
    }

    dataMeteo = {
      ville,
      temperature: result_meteo.current.temperature_2m,
      humidity: result_meteo.current.relative_humidity_2m,
      wind: result_meteo.current.wind_speed_10m,
    };
  } catch (err) {
    console.log("Erreur météo/IP :", err.message);
  }

  res.render("pages/accueil.ejs", { data: dataMeteo });
});



app.get("/accueil", (req, res) => {
   console.log(req);
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
    console.log(email);app.get("/", (req, res) => {
  console.log("Jesus is good");
  res.render("pages/accueil.ejs");
});
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
        // 1. Récupérer les paragraphes du post
        const { rows } = await db.query(
            `SELECT * FROM PARAGRAPH WHERE ID_POST = $1`,
            [id]
        );

        // Construire le texte complet à envoyer à Ollama
        const texteComplet = rows
            .map(row => row.contenu_p)
            .join('\n\n');

        // Valeur par défaut en cas d'erreur IA
        let titreIA = "Erreur : L'IA ne répond pas";

        // 2. Appel à Ollama
        try {
            const response = await fetch(
                `${process.env.OLLAMA_URL}/api/v1/chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: process.env.OLLAMA_MODEL,

                        messages: [
                            {
                                role: "system",
                                content: `
Tu es un assistant spécialisé dans l'analyse et le résumé de textes.

Tu dois respecter exactement le format demandé par l'utilisateur.

Ne donne aucune phrase d'introduction.
Ne donne aucune explication supplémentaire.
`
                            },
                            {
                                role: "user",
                                content: `
Analyze the following text.

Reply ONLY in this exact format:

Catégorie : [text type: example biology, economy, technology, etc] | Titre : [your title maximum 10 words] | Resume : [200 words max, 80 words min]

IMPORTANT:

- Write the Catégorie, Titre and Resume in the SAME language as the text.
- The title must contain maximum 10 words.
- The resume must contain between 80 and 200 words.
- Do not add polite phrases.
- Do not add markdown.
- Do not add anything before or after the requested format.

Text to analyze:

${texteComplet}
`
                            }
                        ],
                        stream: false,
                        think: false,
                        temperature: 0.7,
                        max_tokens: 500
                    })
                }
            );

            // Vérifier si Ollama retourne une erreur HTTP
            if (!response.ok) {
                const errorText = await response.text();

                throw new Error(
                    `Erreur Ollama ${response.status}: ${errorText}`
                );
            }

            const data = await response.json();

            // Avec /api/v1/chat/completions, la réponse est ici (format OpenAI-compatible)
            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                titreIA = data.choices[0].message.content.trim();
            } else {
                console.error("Réponse Ollama inattendue :", data);
                titreIA = "Erreur : réponse IA invalide";
            }

            console.log("Réponse IA :", titreIA);

        } catch (error) {
            console.error("Erreur IA :", error);

            titreIA = "Erreur : L'IA ne répond pas";
        }

        // 3. Récupérer fichiers, post et commentaires en parallèle
        const [
            filesResult,
            postResult,
            commentairesResult
        ] = await Promise.all([
            db.query(
                `SELECT * FROM FILE WHERE ID_POST = $1`,
                [id]
            ),

            db.query(
                `SELECT * FROM POST WHERE ID_POST = $1`,
                [id]
            ),

            db.query(
                `SELECT * FROM commentaires WHERE ID_POST = $1`,
                [id]
            )
        ]);

        const files = filesResult.rows;
        const post = postResult.rows[0];
        const commentaires = commentairesResult.rows;

        // Vérifier que le post existe
        if (!post) {
            return res.status(404).send("Post introuvable");
        }

        // 4. Vérifier si l'utilisateur est admin
        const show =
            req.session.user &&
            req.session.user.is_admin === 1
                ? "show"
                : null;

        // 5. Fusionner paragraphes et fichiers
        const contenu = [
            ...rows.map(p => ({
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
            }))
        ];

        // 6. Trier par date
        contenu.sort(
            (a, b) =>
                new Date(a.date) - new Date(b.date)
        );

        // 7. Afficher la page
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

  if (isNaN(id)) {
    return res.status(400).send("ID invalide");
  }

  const { nom, prenom, commentaire , date_commentaire} = req.body;

  if (!commentaire || !commentaire.trim()) {
    return res.status(400).send("Le commentaire est vide.");
  }

  if (!process.env.OLLAMA_URL) {
    console.error("OLLAMA_URL est undefined");
    return res.status(500).send("Configuration Ollama manquante.");
  }

  try {
    const responseIA = await fetch(
      `${process.env.OLLAMA_URL}/api/chat`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL,

          stream: false,

          think: false,

          options: {
            temperature: 0
          },

          messages: [
            {
              role: "system",
              content: `
Tu es un modérateur strict.

Tu analyses le commentaire utilisateur afin de détecter :

- insultes
- harcèlement
- menaces
- spam
- mots de passe
- clés API
- jetons d'accès
- informations d'authentification sensibles

Tu dois répondre UNIQUEMENT par :Ubuntu Mono

APPROUVÉ

ou

REJET

Aucune explication.
Aucune phrase.
Aucun Markdown.
Un seul mot.
`
            },
            {
              role: "user",
              content: commentaire.trim()
            }
          ]
        })
      }
    );

    const rawResponse = await responseIA.text();

    if (!responseIA.ok) {
      console.error(
        "Erreur HTTP Ollama:",
        responseIA.status,
        rawResponse
      );

      throw new Error("Modération IA indisponible");
    }

    let data;

    try {
      data = JSON.parse(rawResponse);
    } catch (error) {
      console.error(
        "Réponse Ollama non JSON:",
        rawResponse
      );

      throw new Error("Réponse Ollama invalide");
    }

    if (data.error) {
      console.error("Erreur Ollama:", data.error);

      throw new Error("Modération IA indisponible");
    }

    const rawText = data.message?.content ?? "";

    console.log(
      "Réponse brute Ollama:",
      JSON.stringify(rawText)
    );

    const cleanedText = rawText
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .trim();

    const words = cleanedText
      .split(/\s+/)
      .filter(Boolean);

    const decision = (
      words[words.length - 1] ?? ""
    ).toUpperCase();

    console.log("Décision extraite:", decision);

    if (decision === "REJET") {
      return res
        .status(400)
        .send(
          "Votre commentaire a été bloqué par le modérateur IA."
        );
    }

    if (
      decision !== "APPROUVÉ" &&
      decision !== "APPROUVE"
    ) {
      console.warn(
        "Réponse inattendue du modèle:",
        rawText
      );

      return res
        .status(400)
        .send(
          "Modération impossible : réponse inattendue du modèle IA."
        );
    }

    await db.query(
      `
      INSERT INTO commentaires
      (nom, prenom, contenu, date_commentaire, id_post)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        nom?.trim(),
        prenom?.trim(),
        commentaire.trim(),
        date_commentaire,
        id
      ]
    );

    return res.redirect(`/posts/${id}`);

  } catch (err) {
    console.error(
      "Erreur lors de la modération ou de l'insertion :",
      err
    );

    return res
      .status(500)
      .send(
        "Erreur dans la modération ou l'insertion du commentaire."
      );
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


app.listen(port, ()=>{
  console.log("Server is running on port 3000")
})