document.querySelectorAll("[data-max-check]").forEach((group) => {
  const max = Number(group.dataset.maxCheck || 3);
  const boxes = Array.from(group.querySelectorAll('input[type="checkbox"]'));

  boxes.forEach((box) => {
    box.addEventListener("change", () => {
      const checked = boxes.filter((item) => item.checked);
      if (checked.length > max) {
        box.checked = false;
        window.alert(`最多選 ${max} 個主要目標，這樣評估會更聚焦。`);
      }
    });
  });
});

const statsBand = document.querySelector(".stats-band");
const statNumbers = Array.from(document.querySelectorAll(".stat-number[data-count]"));

const countUp = (element) => {
  if (element.dataset.done === "true") return;
  element.dataset.done = "true";

  const target = Number(element.dataset.count || 0);
  const duration = 1300;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(target * eased).toString();

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
};

if (statsBand && statNumbers.length) {
  const showStats = () => {
    statsBand.classList.add("is-visible");
    statNumbers.forEach(countUp);
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          showStats();
          observer.disconnect();
        }
      },
      { threshold: 0.28 }
    );
    observer.observe(statsBand);
  } else {
    showStats();
  }
}

const navLinks = Array.from(document.querySelectorAll(".progress-card a"));
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

const setActiveLink = () => {
  const current = sections
    .slice()
    .reverse()
    .find((section) => section.getBoundingClientRect().top <= 130);

  if (!current) return;

  navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${current.id}`);
  });
};

window.addEventListener("scroll", setActiveLink, { passive: true });
setActiveLink();

const form = document.querySelector(".brief-form");
if (form) {
  form.addEventListener("submit", () => {
    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.textContent = "送出中...";
      button.disabled = true;
    }
  });
}
