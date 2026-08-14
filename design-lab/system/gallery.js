(() => {
  const toast = document.getElementById("toast");
  const toastTitle = document.getElementById("toast-title");
  let hideTimer;

  function showToast(message) {
    if (!toast || !toastTitle) return;
    toastTitle.textContent = message;
    toast.dataset.open = "true";
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      toast.dataset.open = "false";
    }, 2200);
  }

  document.querySelectorAll(".data-table tbody tr[data-toast]").forEach((row) => {
    const activate = () => showToast(row.getAttribute("data-toast") || "Đã chọn dòng");
    row.addEventListener("click", activate);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });

  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    list.querySelectorAll('[role="tab"], .tab').forEach((tab) => {
      tab.addEventListener("click", () => {
        list.querySelectorAll('[role="tab"], .tab').forEach((t) => {
          t.setAttribute("aria-selected", "false");
        });
        tab.setAttribute("aria-selected", "true");
      });
    });
  });

  document.querySelectorAll(".view-switcher").forEach((group) => {
    group.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
      });
    });
  });

  // Highlight nav for current section
  const navLinks = [...document.querySelectorAll('.nav-item[href^="#"]')];
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  function syncNav() {
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= 120) current = section;
    }
    navLinks.forEach((a) => {
      const on = a.getAttribute("href") === `#${current.id}`;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  window.addEventListener("scroll", syncNav, { passive: true });
  syncNav();
})();
