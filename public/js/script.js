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
  });




document.getElementById("annulation").addEventListener("click", ()=>{
   element_modify.forEach(el => el.classList.add("hidden"));

});



