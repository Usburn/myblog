const element = document.getElementById("mobileHeader");
const sideBar = document.getElementById("sideBar");
const elementClose = document.getElementById("close");

element.addEventListener("click", () => {
  console.log("menu got clicked");
  sideBar.classList.add("open");
});

elementClose.addEventListener("click", () => {
  sideBar.classList.remove("open");
});



document.querySelectorAll(".item a").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault(); // stop navigation immédiate

    sideBar.classList.remove("open");

    const url = link.getAttribute("href");

    setTimeout(() => {
      window.location.href = url;
    }, 400); // doit matcher ton CSS transition
  });
});



const element_modify = document.querySelectorAll(".hidden");

  document.getElementById("modif").addEventListener("click", () => {
    element_modify.forEach(el => el.classList.remove("hidden"));
    document.querySelector(".below-post").classList.add("hidden");
  });




document.getElementById("annulation").addEventListener("click", ()=>{
   element_modify.forEach(el => el.classList.add("hidden"));

});


function showCommentaire() {
  const btnCommentaire = document.getElementById("btn-commentaire");



  btnCommentaire.addEventListener("click", () => {
    const text1 = "Ajouter un commentaire"

    const text2 = "Annuler  ajout de commentaire"
    

    document.getElementById("form-commentaire").classList.toggle("hidden");

    if(btnCommentaire.innerHTML===text2){
      btnCommentaire.innerHTML=text1
    }else{
       btnCommentaire.innerHTML = text2

    }
   
  });
}



function regarderTousCommentaires(){
  const tousCommentaires = document.getElementById("regarderTousCommentaires");
  const text2 = "Masquer les commentaires";
  const text1 = "Regarder les commentaires"
  tousCommentaires.addEventListener("click", ()=>{
    document.querySelector(".all-commentaires").classList.toggle("hidden");
    if(tousCommentaires.innerHTML===text2){
      tousCommentaires.innerHTML =  text1

    }else{
      tousCommentaires.innerHTML = text2
    }
    
  });

}


function showReponse() {
  document.querySelectorAll(".btnreponse").forEach(btn => {
    btn.addEventListener("click", function() {
      const form = this.nextElementSibling;
      const text1 = "répondre";
      const text2 = "annuler";
      form.classList.toggle("hidden");
      if(btn.innerHTML ===text1){
        btn.innerHTML = text2
      }else{
         btn.innerHTML = text1

      }
      
    });
  });
}




function init(){
  console.log("BY fgFf")
  showCommentaire();
  regarderTousCommentaires();
  showReponse();
}

window.addEventListener("load", init);






