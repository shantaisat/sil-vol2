const btn = document.getElementById("hamburgerBtn");
const menu = document.getElementById("menu");

btn.addEventListener("click", () => {
  menu.classList.toggle("active");
});
