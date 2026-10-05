function menuMobile() {
  const element = document.getElementById("mobileHeader");
  const sideBar = document.getElementById("sideBar");
  const elementClose = document.getElementById("close");
  if (!element || !sideBar || !elementClose) return;

  element.addEventListener("click", () => sideBar.classList.add("open"));
  elementClose.addEventListener("click", () => sideBar.classList.remove("open"));

  document.querySelectorAll(".item a").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      sideBar.classList.remove("open");
      const url = link.getAttribute("href");
      setTimeout(() => { window.location.href = url; }, 400);
    });
  });
}

function modifierPost() {
  const boutonModif = document.getElementById("modif");
  const boutonAnnuler = document.getElementById("annulation");
  if (!boutonModif || !boutonAnnuler) return;

  const elementsModif = document.querySelectorAll(".edit-field");
  const belowPost = document.querySelector(".below-post");

  boutonModif.addEventListener("click", (e) => {
    e.preventDefault();
    elementsModif.forEach(el => el.classList.remove("hidden"));
    if (belowPost) belowPost.classList.add("hidden");
  });

  boutonAnnuler.addEventListener("click", () => {
    elementsModif.forEach(el => el.classList.add("hidden"));
    if (belowPost) belowPost.classList.remove("hidden");
  });
}

function showCommentaire() {
  const btn = document.getElementById("btn-commentaire");
  const form = document.getElementById("form-commentaire");
  if (!btn || !form) return;

  btn.addEventListener("click", () => {
    const estCache = form.classList.toggle("hidden");
    btn.textContent = estCache ? "Ajouter un commentaire" : "Annuler ajout de commentaire";
  });
}

function regarderTousCommentaires() {
  const btn = document.getElementById("regarderTousCommentaires");
  const liste = document.querySelector(".all-commentaires");
  if (!btn || !liste) return;

  btn.addEventListener("click", () => {
    const estCache = liste.classList.toggle("hidden");
    btn.textContent = estCache ? "Regarder les commentaires" : "Masquer les commentaires";
  });
}

function showReponse() {
  document.querySelectorAll(".btnreponse").forEach(btn => {
    btn.addEventListener("click", () => {
      const form = btn.nextElementSibling;
      if (!form) return;
      const estCache = form.classList.toggle("hidden");
      btn.textContent = estCache ? "répondre" : "annuler";
    });
  });
}

function deconnectionButton() {
  const btn = document.getElementById("connecter");
  console.log(btn);
  if (!btn) return;

  btn.addEventListener("click", () => {
    btn.textContent = "Deconnecter";
  });
}

function init() {
  console.log("BY fgFf");
  menuMobile();
  modifierPost();
  showCommentaire();
  regarderTousCommentaires();
  showReponse();
  deconnectionButton();
}

window.addEventListener("load", init);