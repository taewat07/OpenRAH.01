(() => {
  const finish = document.querySelector(".setup-finish");
  const confetti = document.querySelector(".party-confetti");
  const status = document.querySelector("[data-celebration-status]");

  if (!finish || !confetti) return;

  const colors = [
    "var(--color-blush)",
    "var(--color-buttercream)",
    "var(--color-electric-cobalt)",
    "var(--color-mac-green)",
    "var(--color-obsidian)",
  ];
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 30; index += 1) {
    const particle = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 30;
    const distance = 150 + (index % 6) * 22;
    particle.style.setProperty("--confetti-x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--confetti-y", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--confetti-rotation", `${180 + index * 47}deg`);
    particle.style.setProperty("--confetti-delay", `${(index % 5) * 28}ms`);
    particle.style.setProperty("--confetti-color", colors[index % colors.length]);
    fragment.appendChild(particle);
  }

  confetti.appendChild(fragment);

  const celebrate = () => {
    finish.classList.add("is-celebrating");
    if (status) status.textContent = "ติดตั้งเสร็จแล้ว พร้อมเริ่มประเมินความเสี่ยงหน่วยงาน";
  };

  if (!("IntersectionObserver" in window)) {
    celebrate();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    celebrate();
    observer.disconnect();
  }, { threshold: 0.55 });

  observer.observe(finish);
})();
