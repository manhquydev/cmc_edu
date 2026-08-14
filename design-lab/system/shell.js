/* Shared lab shell: nav render, density context, and pattern interactions.
   One script for every gallery page; page identity comes from <body data-page>. */

const ICONS = {
  layers:
    '<path d="M8 1.6 14.4 5 8 8.4 1.6 5 8 1.6Z"/><path d="M2.6 8 8 10.9 13.4 8"/><path d="M2.6 11 8 13.9 13.4 11"/>',
  grid: '<rect x="1.8" y="1.8" width="5" height="5" rx="1"/><rect x="9.2" y="1.8" width="5" height="5" rx="1"/><rect x="1.8" y="9.2" width="5" height="5" rx="1"/><rect x="9.2" y="9.2" width="5" height="5" rx="1"/>',
  funnel: '<path d="M1.8 2.6h12.4L9.4 8v5.4L6.6 12V8L1.8 2.6Z"/>',
  wallet:
    '<rect x="1.8" y="3.6" width="12.4" height="9" rx="1.6"/><path d="M11 8h2"/><path d="M1.8 6.4h12.4"/>',
  calendar:
    '<rect x="2" y="3.2" width="12" height="11" rx="1.6"/><path d="M2 6.6h12"/><path d="M5.4 1.8v2.6"/><path d="M10.6 1.8v2.6"/>',
  users:
    '<circle cx="6" cy="5.4" r="2.4"/><path d="M1.8 13.4c0-2.3 1.9-3.8 4.2-3.8s4.2 1.5 4.2 3.8"/><path d="M11 4.2a2.2 2.2 0 0 1 0 4.2"/><path d="M12 13.4c0-1.7-.5-2.8-1.4-3.5"/>',
  badgeCheck:
    '<path d="M8 1.8 9.9 3l2.2-.1.6 2.1 1.5 1.6-1.1 1.9.3 2.2-2 .8L10 13.6l-2-.7-2 .7-1.4-2.1-2-.8.3-2.2L1.8 6.6l1.5-1.6.6-2.1L6.1 3 8 1.8Z"/><path d="M5.9 8.1 7.4 9.6l3-3.2"/>',
  gift: '<rect x="1.8" y="5.6" width="12.4" height="8.6" rx="1.4"/><path d="M1.8 8.8h12.4"/><path d="M8 5.6v8.6"/><path d="M8 5.6C6.6 3.4 5.6 2.4 4.4 2.8 3.2 3.2 3.6 5.2 8 5.6Z"/><path d="M8 5.6c1.4-2.2 2.4-3.2 3.6-2.8 1.2.4.8 2.4-3.6 2.8Z"/>',
  history:
    '<path d="M8 4.2v4l2.8 1.6"/><path d="M14 8a6 6 0 1 1-2.2-4.6"/><path d="M14.2 2v3h-3"/>',
  printer:
    '<path d="M4.4 6V2.4h7.2V6"/><rect x="1.8" y="6" width="12.4" height="5.2" rx="1.4"/><path d="M4.4 9.8h7.2v3.8H4.4z"/>',
  search:
    '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 13.5 13.5" stroke-linecap="round"/>',
};

const NAV = [
  {
    group: "Nền tảng",
    items: [
      { id: "foundations", label: "Tokens & nền tảng", href: "index.html", icon: "layers" },
      { id: "patterns", label: "Pattern dùng chung", href: "patterns.html", icon: "grid" },
    ],
  },
  {
    group: "Module",
    items: [
      { id: "crm", label: "CRM · Pipeline", href: "modules/crm.html", icon: "funnel" },
      { id: "finance", label: "Tài chính · Phiếu thu", href: "modules/finance.html", icon: "wallet" },
      { id: "teaching", label: "Giảng dạy · Lớp", href: "modules/teaching.html", icon: "calendar" },
      { id: "students", label: "Học viên", href: "modules/students.html", icon: "users" },
      { id: "hr", label: "Nhân sự · KPI", href: "modules/hr.html", icon: "badgeCheck" },
      { id: "engagement", label: "Quà & điểm", href: "modules/engagement.html", icon: "gift" },
      { id: "audit", label: "Audit · Sổ ghi", href: "modules/audit.html", icon: "history" },
      { id: "print", label: "Bản in", href: "modules/print.html", icon: "printer" },
    ],
  },
];

const LINKS = [
  { label: "Cockpit 5 vai trò", href: "/cockpit-roles/?role=giam_doc_kinh_doanh" },
  { label: "Bridge → @cmc/ui", href: "BRIDGE.md" },
];

function icon(name) {
  return `<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

function renderSidebar(host) {
  const page = document.body.dataset.page || "";
  const root = document.body.dataset.root || "";
  const groups = NAV.map(
    (group) => `
      <div>
        <p class="nav-group-label">${group.group}</p>
        <ul class="nav-list">
          ${group.items
            .map(
              (item) => `<li><a class="nav-item${item.id === page ? " is-active" : ""}"${
                item.id === page ? ' aria-current="page"' : ""
              } href="${root}${item.href}">${icon(item.icon)}<span>${item.label}</span></a></li>`,
            )
            .join("")}
        </ul>
      </div>`,
  ).join("");

  host.innerHTML = `
    <div class="brand">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-name">CMC EDU Lab</span>
    </div>
    <button type="button" class="search-trigger" data-palette-open>
      ${icon("search")}<span>Tìm pattern…</span><kbd>⌘K</kbd>
    </button>
    <nav class="nav" aria-label="Mục hệ thống thiết kế">
      ${groups}
      <div>
        <p class="nav-group-label">Liên kết</p>
        <ul class="nav-list">
          ${LINKS.map(
            (l) =>
              `<li><a class="nav-item" href="${l.href.startsWith("/") ? l.href : root + l.href}">${l.label}</a></li>`,
          ).join("")}
        </ul>
      </div>
    </nav>
    <div class="sidebar-user">
      <span class="avatar" aria-hidden="true">DS</span>
      <div>
        <div class="sidebar-user-name">Design system</div>
        <div class="sidebar-user-role">Lab first · Hybrid</div>
      </div>
    </div>`;
}

function wireDensity() {
  const group = document.querySelector("[data-density-group]");
  if (!group) return;
  // A page that declares its own density owns it. Audit is dense-by-trade, so a
  // "comfortable" choice made on Foundations must not follow the operator there.
  // Preference is therefore stored per page, and the page default wins until the
  // operator picks a density on that page.
  const page = document.body.dataset.page || "system";
  const storageKey = `cmc-lab-density:${page}`;
  const saved =
    localStorage.getItem(storageKey) || document.body.dataset.densityDefault || "default";
  applyDensity(saved);
  group.querySelectorAll("button[data-density-set]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.densitySet === saved));
    btn.addEventListener("click", () => {
      const value = btn.dataset.densitySet;
      applyDensity(value);
      localStorage.setItem(storageKey, value);
      group
        .querySelectorAll("button[data-density-set]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      toast("Mật độ: " + btn.textContent.trim(), "--size-row đổi, thang chữ giữ nguyên");
    });
  });
}

function applyDensity(value) {
  if (value === "default") document.documentElement.removeAttribute("data-density");
  else document.documentElement.setAttribute("data-density", value);
}

let toastTimer;
function toast(title, meta) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.querySelector("[data-toast-title]").textContent = title;
  const metaEl = el.querySelector("[data-toast-meta]");
  if (metaEl) metaEl.textContent = meta || "";
  el.dataset.open = "true";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.dataset.open = "false";
  }, 2400);
}

function wireTabs() {
  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll(".tab")];
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      });
    });
  });
  document.querySelectorAll(".btn-group:not([data-density-group])").forEach((group) => {
    const btns = [...group.querySelectorAll("button")];
    btns.forEach((btn) =>
      btn.addEventListener("click", () =>
        btns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn))),
      ),
    );
  });
  document.querySelectorAll(".saved-views").forEach((group) => {
    const views = [...group.querySelectorAll(".saved-view")];
    views.forEach((view) =>
      view.addEventListener("click", () => {
        views.forEach((v) => v.setAttribute("aria-pressed", String(v === view)));
        const url = document.querySelector("[data-url-state]");
        if (url && view.dataset.query) url.textContent = view.dataset.query;
      }),
    );
  });
}

function wireSort() {
  // Every sortable column advertises its state, including the unsorted ones:
  // a screen reader must be able to tell "sortable, currently not sorted"
  // from "not sortable at all".
  document.querySelectorAll("th[data-sortable]").forEach((th) => {
    if (!th.hasAttribute("aria-sort")) th.setAttribute("aria-sort", "none");
  });
  document.querySelectorAll("th[data-sortable] .sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const th = btn.closest("th");
      const table = th.closest("table");
      const next = th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      table
        .querySelectorAll("th[data-sortable]")
        .forEach((other) => other.setAttribute("aria-sort", "none"));
      th.setAttribute("aria-sort", next);
    });
  });
}

function wireSelection() {
  document.querySelectorAll("[data-selectable-table]").forEach((table) => {
    const bar = document.querySelector(`[data-bulk-for="${table.dataset.selectableTable}"]`);
    const rows = [...table.querySelectorAll("tbody tr")];
    const all = table.querySelector("thead input[type=checkbox]");

    const sync = () => {
      const selected = rows.filter((r) => r.querySelector("input[type=checkbox]")?.checked);
      rows.forEach((r) =>
        r.setAttribute("aria-selected", String(!!r.querySelector("input[type=checkbox]")?.checked)),
      );
      if (!bar) return;
      bar.hidden = selected.length === 0;
      const count = bar.querySelector("[data-bulk-count]");
      if (count) count.textContent = String(selected.length);
      const scope = bar.querySelector("[data-bulk-scope]");
      if (scope)
        scope.hidden = !(all && all.checked) || selected.length !== rows.length;
    };

    rows.forEach((row) => {
      const box = row.querySelector("input[type=checkbox]");
      if (box) box.addEventListener("change", sync);
    });
    if (all)
      all.addEventListener("change", () => {
        rows.forEach((r) => {
          const box = r.querySelector("input[type=checkbox]");
          if (box) box.checked = all.checked;
        });
        sync();
      });
    sync();
  });
}

function wireRowDrawer() {
  document.querySelectorAll("[data-drawer-table]").forEach((table) => {
    const rows = [...table.querySelectorAll("tbody tr")];
    rows.forEach((row) => {
      const open = () => {
        rows.forEach((r) => r.setAttribute("aria-current", String(r === row)));
        const drawer = document.querySelector(`[data-drawer-for="${table.dataset.drawerTable}"]`);
        if (!drawer) return;
        drawer.querySelectorAll("[data-field]").forEach((slot) => {
          const key = slot.dataset.field;
          const src = row.querySelector(`[data-cell="${key}"]`);
          if (src) slot.innerHTML = src.innerHTML;
        });
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
    rows[0]?.click();
  });
}

function wireAttendance() {
  const cycle = ["", "present", "late", "absent"];
  const labels = { "": "–", present: "C", late: "M", absent: "V" };
  document.querySelectorAll(".mark").forEach((mark) => {
    mark.addEventListener("click", () => {
      const current = mark.dataset.state || "";
      const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
      mark.dataset.state = next;
      mark.textContent = labels[next];
      mark.setAttribute(
        "aria-label",
        `${mark.dataset.student || "Học viên"} — ${
          { "": "chưa ghi", present: "có mặt", late: "muộn", absent: "vắng" }[next]
        }`,
      );
    });
  });
}

function wireGradebook() {
  const dirty = new Set();
  const bar = document.querySelector("[data-publish-bar]");
  document.querySelectorAll(".grade-input").forEach((input) => {
    input.addEventListener("input", () => {
      const value = Number(input.value);
      input.dataset.dirty = "true";
      dirty.add(input);
      const letter = input.closest("tr")?.querySelector(".grade-letter");
      if (letter && !Number.isNaN(value) && input.value !== "") {
        const band = value >= 8 ? "high" : value >= 6.5 ? "mid" : "low";
        letter.dataset.band = band;
        letter.textContent = value >= 8 ? "A" : value >= 6.5 ? "B" : value >= 5 ? "C" : "D";
      }
      if (bar) {
        const count = bar.querySelector("[data-dirty-count]");
        if (count) count.textContent = String(dirty.size);
        bar.dataset.dirty = "true";
      }
    });
  });
}

function wireBoard() {
  let dragged = null;
  document.querySelectorAll(".board-card").forEach((card) => {
    card.draggable = true;
    card.addEventListener("dragstart", () => {
      dragged = card;
      card.dataset.dragging = "true";
    });
    card.addEventListener("dragend", () => {
      card.dataset.dragging = "false";
      dragged = null;
    });
  });
  document.querySelectorAll(".board-col-body").forEach((body) => {
    body.addEventListener("dragover", (e) => e.preventDefault());
    body.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragged) return;
      body.appendChild(dragged);
      const stage = body.closest(".board-col")?.querySelector(".board-col-name")?.textContent;
      toast("Đã chuyển giai đoạn", `${dragged.querySelector(".board-card-title")?.textContent} → ${stage}`);
    });
  });
}

function wirePalette() {
  const dialog = document.getElementById("palette-dialog");
  const triggers = [...document.querySelectorAll("[data-palette-open]")];
  const supported = dialog && typeof dialog.showModal === "function";
  if (!supported) {
    // No dialog on this page, or no modal support: retire the trigger rather
    // than leaving a control that does nothing when pressed.
    triggers.forEach((btn) => {
      btn.hidden = true;
    });
    return;
  }
  const open = () => dialog.showModal();
  triggers.forEach((btn) => btn.addEventListener("click", open));
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      open();
    }
  });
}

function wireConfirmGate() {
  document.querySelectorAll("[data-confirm]").forEach((trigger) => {
    const dialog = document.getElementById(trigger.dataset.confirm);
    if (!dialog || typeof dialog.showModal !== "function") return;
    trigger.addEventListener("click", () => dialog.showModal());
    dialog.querySelectorAll("[data-confirm-cancel]").forEach((btn) =>
      btn.addEventListener("click", () => dialog.close("cancel")),
    );
    dialog.querySelectorAll("[data-confirm-accept]").forEach((btn) =>
      btn.addEventListener("click", () => {
        dialog.close("accept");
        toast(btn.dataset.toast || "Đã thực hiện", btn.dataset.toastMeta || "");
      }),
    );
  });
}

function wireRetry() {
  document.querySelectorAll("[data-retry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const strip = btn.closest(".retry-strip");
      const target = document.getElementById(btn.dataset.retry);
      if (strip) strip.hidden = true;
      if (target) target.hidden = false;
      toast("Đang tải lại danh sách", "Bộ lọc và trang hiện tại được giữ nguyên");
    });
  });
}

function wireRoleTwin() {
  document.querySelectorAll("[data-role-view]").forEach((scope) => {
    const buttons = [...scope.querySelectorAll("[data-role-set]")];
    const apply = (role) => {
      scope.dataset.roleView = role;
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.roleSet === role)));
    };
    buttons.forEach((btn) =>
      btn.addEventListener("click", () => {
        apply(btn.dataset.roleSet);
        toast(
          "Đang xem như " + btn.textContent.trim(),
          "Cùng một khung, dữ liệu đổi theo quyền chứ không phải giao diện",
        );
      }),
    );
    apply(scope.dataset.roleView || "gdkd");
  });
}

function wireToastTriggers() {
  document.querySelectorAll("[data-toast]").forEach((el) => {
    el.addEventListener("click", () => toast(el.dataset.toast, el.dataset.toastMeta || ""));
  });
}

function wireLoadingDemo() {
  document.querySelectorAll("[data-loading-demo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.dataset.loading = "true";
      setTimeout(() => {
        btn.dataset.loading = "false";
        toast("Đã lưu", "Trạng thái loading giữ nguyên kích thước nút");
      }, 1100);
    });
  });
}

function wireSectionNav() {
  const links = [...document.querySelectorAll('.toc a[href^="#"]')];
  if (!links.length) return;
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const sync = () => {
    let current = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top <= 140) current = s;
    links.forEach((a) => {
      const on = a.getAttribute("href") === `#${current.id}`;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  };
  window.addEventListener("scroll", sync, { passive: true });
  sync();
}

document.addEventListener("DOMContentLoaded", () => {
  const host = document.querySelector("[data-shell]");
  if (host) renderSidebar(host);
  wireDensity();
  wireTabs();
  wireSort();
  wireSelection();
  wireRowDrawer();
  wireAttendance();
  wireGradebook();
  wireBoard();
  wirePalette();
  wireConfirmGate();
  wireRetry();
  wireRoleTwin();
  wireToastTriggers();
  wireLoadingDemo();
  wireSectionNav();
});
