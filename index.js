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
const port = process.env.PORT || 3000;
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
console.log("SECRET:", process.env.SECRET);


const { Pool } = pg;

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
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

app.get("/CV", (req, res) => {
  res.render("CV/cv");
});
app.get("/CV/en", (req, res) => {
  res.render("CV/cv_en");
});

app.listen(port, () => {
  console.log(`Le serveur marche sur ${port}`);
});
