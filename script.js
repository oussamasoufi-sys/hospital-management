/*
  Hospital Management Dashboard
  Vanilla JavaScript interactions (no backend)

  Features:
  - Mobile sidebar toggle + overlay
  - Active menu highlighting
  - Animated counters (dummy data)
  - Simple list interaction (mark appointment as completed)
*/

(() => {
  "use strict";

  // ---------- Utilities ----------
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Elements ----------
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");
  const sidebarToggle = $("#sidebarToggle");
  const sidebarClose = $("#sidebarClose");
  const notificationBtn = $("#notificationBtn");
  const notificationBadge = $("#notificationBadge");
  const todayDate = $("#todayDate");
  const year = $("#year");
  const pagesRoot = $("#pages");

  // Dashboard placeholders
  const dashboardRecentPatientsBody = $("#dashboardRecentPatientsBody");
  const dashboardAppointmentsList = $("#dashboardAppointmentsList");
  const dashboardDoctorsGrid = $("#dashboardDoctorsGrid");

  // Page placeholders
  const patientsTableBody = $("#patientsTableBody");
  const doctorsGrid = $("#doctorsGrid");
  const appointmentsList = $("#appointmentsList");
  const departmentsTableBody = $("#departmentsTableBody");
  const pharmacyTableBody = $("#pharmacyTableBody");
  const laboratoryTableBody = $("#laboratoryTableBody");
  const billingTableBody = $("#billingTableBody");
  const billingItemsBody = $("#billingItemsBody");
  const billingItemsSubtitle = $("#billingItemsSubtitle");
  const addPatientForm = $("#addPatientForm");
  const addPatientMsg = $("#addPatientMsg");
  const addDoctorForm = $("#addDoctorForm");
  const addDoctorMsg = $("#addDoctorMsg");
  const doctorDepartmentSelect = $("#doctorDepartmentSelect");
  const addBillForm = $("#addBillForm");
  const addBillMsg = $("#addBillMsg");
  const billPatientSelect = $("#billPatientSelect");
  const addBillItemForm = $("#addBillItemForm");
  const addBillItemMsg = $("#addBillItemMsg");
  const reduceMotionToggle = $("#reduceMotionToggle");
  const logoutBtn = $("#logoutBtn");

  let selectedBillId = null;
  let selectedBillNo = null;

  if (!sidebar || !overlay || !sidebarToggle || !sidebarClose) {
    // If DOM changes in the future, fail safely.
    return;
  }

  // ---------- Date/Time UI ----------
  const now = new Date();
  if (todayDate) {
    const formatted = now.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
    todayDate.textContent = formatted;
  }
  if (year) {
    year.textContent = String(now.getFullYear());
  }

  // ---------- Sidebar Drawer (mobile) ----------
  const setSidebarOpen = (open) => {
    sidebar.classList.toggle("is-open", open);
    overlay.classList.toggle("is-open", open);

    // Keep ARIA state in sync for assistive technologies.
    sidebarToggle.setAttribute("aria-expanded", String(open));

    // Prevent background scroll when drawer is open.
    document.body.style.overflow = open ? "hidden" : "";

    // Keep overlay semantics accurate.
    overlay.setAttribute("aria-hidden", String(!open));
  };

  sidebarToggle.addEventListener("click", () => setSidebarOpen(true));
  sidebarClose.addEventListener("click", () => setSidebarOpen(false));
  overlay.addEventListener("click", () => setSidebarOpen(false));

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setSidebarOpen(false);
  });

  // If we resize to desktop widths, ensure the body scroll is restored.
  window.addEventListener("resize", () => {
    if (window.innerWidth > 920) {
      setSidebarOpen(false);
    }
  });

  // ---------- Active menu highlighting ----------
  const navItems = $$(".nav__item");
  const setActiveNav = (route) => {
    navItems.forEach((x) => x.classList.remove("is-active"));
    const match = navItems.find((x) => x.getAttribute("data-route") === route);
    if (match) match.classList.add("is-active");
  };

  const setActivePage = (route) => {
    if (!pagesRoot) return;
    const pages = $$(".page", pagesRoot);
    pages.forEach((p) => p.classList.toggle("is-active", p.getAttribute("data-page") === route));
  };

  const routeFromHash = () => {
    const h = String(location.hash || "").replace(/^#/, "").trim();
    return h || "dashboard";
  };

  const safeRoute = (route) => {
    const allowed = new Set([
      "dashboard",
      "patients",
      "doctors",
      "appointments",
      "departments",
      "pharmacy",
      "laboratory",
      "billing",
      "settings",
      "logout",
    ]);
    return allowed.has(route) ? route : "dashboard";
  };

  const navigate = async (route, opts = { updateHash: true }) => {
    const r = safeRoute(route);
    setActiveNav(r);
    setActivePage(r);
    if (opts.updateHash) location.hash = `#${r}`;

    // On mobile, close the drawer after selection.
    setSidebarOpen(false);

    // Load data for the target page.
    await loadRouteData(r);
  };

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const route = item.getAttribute("data-route") || "dashboard";
      navigate(route);
    });
  });

  // ---------- Animated counters ----------
  const animateCounter = (el, to) => {
    const duration = 900;
    const start = 0;
    const startTime = performance.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (time) => {
      const progress = Math.min(1, (time - startTime) / duration);
      const value = Math.round(start + (to - start) * easeOutCubic(progress));
      el.textContent = value.toLocaleString();

      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  const counters = $$('[data-counter]');
  const runCounters = () => {
    counters.forEach((el) => {
      const to = Number(el.getAttribute("data-to") || "0");
      el.textContent = prefersReducedMotion ? to.toLocaleString() : "0";
      if (!prefersReducedMotion) animateCounter(el, to);
    });
  };

  // If the dashboard is hosted by server.js, we can populate the counters
  // from the API (still purely demo data). If the fetch fails (e.g., opened
  // as a local file), we fall back to the existing HTML data-to attributes.
  const tryLoadStatsFromApi = async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) return;
      const stats = await res.json();

      // Map API fields to card order.
      const values = [
        stats.totalPatients,
        stats.doctorsAvailable,
        stats.appointmentsToday,
        stats.availableBeds,
      ];

      counters.forEach((el, idx) => {
        const next = Number(values[idx] ?? el.getAttribute("data-to") ?? 0);
        el.setAttribute("data-to", String(next));
      });
    } catch {
      // Silent fallback to static values.
    }
  };

  const pillClassForStatus = (statusText) => {
    const s = String(statusText || "").toLowerCase();
    if (s.includes("confirm")) return "pill--ok";
    if (s.includes("progress")) return "pill--info";
    if (s.includes("pend")) return "pill--warn";
    if (s.includes("sched")) return "pill--info";
    if (s.includes("complete")) return "pill--done";
    return "pill--info";
  };

  const statusClassForPatient = (statusText) => {
    const s = String(statusText || "").toLowerCase();
    if (s.includes("stable")) return "status--ok";
    if (s.includes("observ")) return "status--warn";
    if (s.includes("test")) return "status--info";
    if (s.includes("critic")) return "status--danger";
    return "status--info";
  };

  const initialsFromName = (name) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || "?";
    const second = parts[1]?.[0] || parts[0]?.[1] || "?";
    return (first + second).toUpperCase();
  };

  const safeText = (value, fallback = "—") => {
    const v = value === null || value === undefined || value === "" ? fallback : String(value);
    return v;
  };

  const renderPatients = (rows, tbody, limit = 5) => {
    if (!tbody || !Array.isArray(rows) || rows.length === 0) return;
    const take = rows.slice(0, limit);
    tbody.innerHTML = "";

    for (const r of take) {
      const tr = document.createElement("tr");
      const id = safeText(r.id);
      const name = safeText(r.name);
      const dept = safeText(r.department);
      const status = safeText(r.status);
      const room = safeText(r.room);

      tr.innerHTML = `
        <td>
          <div class="person">
            <div class="avatar" aria-hidden="true">${initialsFromName(name)}</div>
            <div>
              <div class="person__name">${name}</div>
              <div class="person__meta">ID: ${id}</div>
            </div>
          </div>
        </td>
        <td>${dept}</td>
        <td><span class="status ${statusClassForPatient(status)}">${status}</span></td>
        <td class="t-right">${room}</td>
      `;
      tbody.appendChild(tr);
    }
  };

  const renderAppointments = (rows, listEl) => {
    if (!listEl || !Array.isArray(rows) || rows.length === 0) return;
    listEl.innerHTML = "";

    for (const r of rows) {
      const item = document.createElement("div");
      item.className = "list__item";
      item.setAttribute("role", "listitem");

      const time = safeText(r.time);
      const title = safeText(r.title);
      const meta = safeText(r.meta);
      const status = safeText(r.status, "Scheduled");
      const pillClass = pillClassForStatus(status);

      item.innerHTML = `
        <div class="list__time">${time}</div>
        <div class="list__content">
          <div class="list__title">${title}</div>
          <div class="list__meta">${meta}</div>
        </div>
        <span class="pill ${pillClass}" data-original-text="${status}" data-original-class="${pillClass}">${status}</span>
      `;

      listEl.appendChild(item);
    }
  };

  const dotClassForAvailability = (availabilityText) => {
    const s = String(availabilityText || "").toLowerCase();
    if (s.includes("off")) return "dot--danger";
    if (s.includes("round")) return "dot--warn";
    return "dot--ok";
  };

  const renderDoctors = (rows, gridEl, limit = 8) => {
    if (!gridEl || !Array.isArray(rows) || rows.length === 0) return;
    gridEl.innerHTML = "";

    for (const r of rows.slice(0, limit)) {
      const card = document.createElement("article");
      card.className = "doctor";
      card.tabIndex = 0;

      const initials = safeText(r.initials, initialsFromName(r.name));
      const name = safeText(r.name);
      const dept = safeText(r.department);
      const availability = safeText(r.availability, "On duty");
      const dot = dotClassForAvailability(availability);

      card.innerHTML = `
        <div class="doctor__photo" role="img" aria-label="Doctor photo placeholder">
          <div class="doctor__initials">${initials}</div>
        </div>
        <div class="doctor__info">
          <div class="doctor__name">${name}</div>
          <div class="doctor__dept">${dept}</div>
        </div>
        <div class="doctor__meta">
          <span class="dot ${dot}" aria-hidden="true"></span>
          <span>${availability}</span>
        </div>
      `;

      gridEl.appendChild(card);
    }
  };

  const renderDepartments = (rows) => {
    if (!departmentsTableBody || !Array.isArray(rows)) return;
    departmentsTableBody.innerHTML = "";
    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${safeText(r.name)}</strong></td>
        <td>${safeText(r.location)}</td>
        <td>${safeText(r.phone)}</td>
      `;
      departmentsTableBody.appendChild(tr);
    }
  };

  const statusPillFromInventory = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "in_stock") return { cls: "status--ok", text: "In stock" };
    if (s === "low_stock") return { cls: "status--warn", text: "Low stock" };
    if (s === "out_of_stock") return { cls: "status--danger", text: "Out of stock" };
    return { cls: "status--info", text: safeText(status) };
  };

  const renderPharmacy = (rows) => {
    if (!pharmacyTableBody || !Array.isArray(rows)) return;
    pharmacyTableBody.innerHTML = "";
    for (const r of rows) {
      const pill = statusPillFromInventory(r.status);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div class="person">
            <div class="avatar" aria-hidden="true"><i class="fa-solid fa-pills" aria-hidden="true"></i></div>
            <div>
              <div class="person__name">${safeText(r.name)}</div>
              <div class="person__meta">Code: ${safeText(r.code)}</div>
            </div>
          </div>
        </td>
        <td>${safeText(r.category)}</td>
        <td><span class="status ${pill.cls}">${pill.text}</span></td>
        <td class="t-right">${safeText(r.stock)} ${safeText(r.unit, "")}</td>
      `;
      pharmacyTableBody.appendChild(tr);
    }
  };

  const renderLaboratory = (rows) => {
    if (!laboratoryTableBody || !Array.isArray(rows)) return;
    laboratoryTableBody.innerHTML = "";
    for (const r of rows) {
      const status = String(r.status || "").toLowerCase();
      const statusText = status === "completed" ? "Completed" : status === "in_progress" ? "In progress" : "Ordered";
      const statusClass = status === "completed" ? "status--ok" : status === "in_progress" ? "status--info" : "status--warn";
      const pr = String(r.priority || "").toLowerCase() === "urgent" ? "Urgent" : "Routine";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div class="person">
            <div class="avatar" aria-hidden="true">${initialsFromName(r.patient)}</div>
            <div>
              <div class="person__name">${safeText(r.patient)}</div>
              <div class="person__meta">ID: ${safeText(r.patient_id)}</div>
            </div>
          </div>
        </td>
        <td>${safeText(r.test_name)}</td>
        <td>${pr}</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td class="t-right">${safeText(r.ordered_at)}</td>
      `;
      laboratoryTableBody.appendChild(tr);
    }
  };

  const renderBilling = (rows) => {
    if (!billingTableBody || !Array.isArray(rows)) return;
    billingTableBody.innerHTML = "";

    for (const r of rows) {
      const status = String(r.status || "").toLowerCase();
      const statusText =
        status === "paid" ? "Paid" : status === "partially_paid" ? "Partially paid" : status === "void" ? "Void" : "Unpaid";
      const statusClass = status === "paid" ? "status--ok" : status === "void" ? "status--danger" : "status--warn";

      const tr = document.createElement("tr");
      tr.setAttribute("data-bill-id", String(r.id));
      tr.style.cursor = "pointer";
      tr.innerHTML = `
        <td><strong>${safeText(r.bill_no)}</strong></td>
        <td>${safeText(r.patient)}</td>
        <td>${safeText(r.bill_date)}</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td class="t-right">${Number(r.total_amount || 0).toFixed(2)} ${safeText(r.currency)}</td>
      `;
      billingTableBody.appendChild(tr);
    }
  };

  const renderBillingItems = (billNo, items) => {
    if (!billingItemsBody) return;
    billingItemsBody.innerHTML = "";
    if (billingItemsSubtitle) billingItemsSubtitle.textContent = billNo ? `Items for ${billNo}` : "Select a bill to view details.";

    if (!Array.isArray(items) || items.length === 0) return;
    for (const it of items) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${safeText(it.description)}</td>
        <td class="t-right">${safeText(it.qty)}</td>
        <td class="t-right">${Number(it.unit_price || 0).toFixed(2)}</td>
        <td class="t-right">${Number(it.line_total || 0).toFixed(2)}</td>
      `;
      billingItemsBody.appendChild(tr);
    }
  };

  const fetchJson = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  };

  const postJson = async (url, payload) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg = data?.error || "Request failed";
      throw new Error(msg);
    }
    return data;
  };

  const setHint = (el, text, variant = "info") => {
    if (!el) return;
    const icon = variant === "ok" ? "fa-circle-check" : variant === "warn" ? "fa-triangle-exclamation" : "fa-circle-info";
    el.innerHTML = `
      <i class="fa-solid ${icon}" aria-hidden="true"></i>
      <span>${safeText(text || "")}</span>
    `;
  };

  const fillSelect = (selectEl, options, placeholder = "Select…") => {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = placeholder;
    selectEl.appendChild(ph);

    for (const opt of options || []) {
      const o = document.createElement("option");
      o.value = String(opt.value);
      o.textContent = opt.label;
      selectEl.appendChild(o);
    }
  };

  const renderEmptyTable = (tbody, message, colSpan) => {
    if (!tbody) return;
    tbody.innerHTML = "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="${Number(colSpan || 1)}" class="muted">
        ${safeText(message || "No data")}
      </td>
    `;
    tbody.appendChild(tr);
  };

  const renderEmptyList = (listEl, message) => {
    if (!listEl) return;
    listEl.innerHTML = `
      <div class="hint">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        <span>${safeText(message || "No items")}</span>
      </div>
    `;
  };

  const renderEmptyGrid = (gridEl, message) => {
    if (!gridEl) return;
    gridEl.innerHTML = `
      <div class="hint">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        <span>${safeText(message || "No items")}</span>
      </div>
    `;
  };

  const loadRouteData = async (route) => {
    // If opened directly as a local file, API fetches will fail; UI stays with static content.
    try {
      if (route === "dashboard") {
        const [patients, appts, doctors] = await Promise.all([
          fetchJson("/api/patients?limit=10"),
          fetchJson("/api/appointments?day=today"),
          fetchJson("/api/doctors?limit=20"),
        ]);
        renderPatients(patients, dashboardRecentPatientsBody, 5);
        renderAppointments(appts, dashboardAppointmentsList);
        renderDoctors(doctors, dashboardDoctorsGrid, 4);
      }

      if (route === "patients") {
        const rows = await fetchJson("/api/patients?limit=50");
        renderPatients(rows, patientsTableBody, 50);
      }

      if (route === "doctors") {
        const [depts, rows] = await Promise.all([
          fetchJson("/api/departments"),
          fetchJson("/api/doctors?limit=50"),
        ]);
        fillSelect(
          doctorDepartmentSelect,
          (depts || []).map((d) => ({ value: d.id, label: d.name })),
          "Select department…"
        );
        renderDoctors(rows, doctorsGrid, 12);
      }

      if (route === "appointments") {
        const rows = await fetchJson("/api/appointments?day=today");
        renderAppointments(rows, appointmentsList);
      }

      if (route === "departments") {
        const rows = await fetchJson("/api/departments");
        renderDepartments(rows);
      }

      if (route === "pharmacy") {
        const rows = await fetchJson("/api/pharmacy");
        renderPharmacy(rows);
      }

      if (route === "laboratory") {
        const rows = await fetchJson("/api/laboratory");
        renderLaboratory(rows);
      }

      if (route === "billing") {
        const [patients, rows] = await Promise.all([
          fetchJson("/api/patients?limit=100"),
          fetchJson("/api/billing"),
        ]);
        fillSelect(
          billPatientSelect,
          (patients || []).map((p) => ({ value: p.patientId, label: `${p.id} — ${p.name}` })),
          "Select patient…"
        );
        renderBilling(rows);

        const first = rows?.[0];
        if (first?.id) {
          selectedBillId = Number(first.id);
          selectedBillNo = String(first.bill_no || "");
          const items = await fetchJson(`/api/billing/items?billId=${encodeURIComponent(first.id)}`);
          renderBillingItems(first.bill_no, items);
        } else {
          selectedBillId = null;
          selectedBillNo = null;
          renderBillingItems(null, []);
        }
      }
    } catch {
      const msg = "Could not load data. Start the server and configure MySQL (.env).";

      if (route === "dashboard") {
        renderEmptyTable(dashboardRecentPatientsBody, msg, 4);
        renderEmptyList(dashboardAppointmentsList, msg);
        renderEmptyGrid(dashboardDoctorsGrid, msg);
      }
      if (route === "patients") renderEmptyTable(patientsTableBody, msg, 4);
      if (route === "doctors") renderEmptyGrid(doctorsGrid, msg);
      if (route === "appointments") renderEmptyList(appointmentsList, msg);
      if (route === "departments") renderEmptyTable(departmentsTableBody, msg, 3);
      if (route === "pharmacy") renderEmptyTable(pharmacyTableBody, msg, 4);
      if (route === "laboratory") renderEmptyTable(laboratoryTableBody, msg, 5);
      if (route === "billing") {
        renderEmptyTable(billingTableBody, msg, 5);
        renderEmptyTable(billingItemsBody, "Select a bill to view details.", 4);
        if (billingItemsSubtitle) billingItemsSubtitle.textContent = "Select a bill to view details.";
        fillSelect(billPatientSelect, [], "Start server to load patients…");
      }
      if (route === "doctors") fillSelect(doctorDepartmentSelect, [], "Start server to load departments…");
    }
  };

  // Run once on load.
  // If API is available, load first then animate.
  (async () => {
    // Settings: manual reduced motion toggle
    const storedReduce = localStorage.getItem("hmd-reduce-motion");
    if (storedReduce === "1") document.body.classList.add("reduce-motion");
    if (reduceMotionToggle) {
      reduceMotionToggle.checked = document.body.classList.contains("reduce-motion");
      reduceMotionToggle.addEventListener("change", () => {
        document.body.classList.toggle("reduce-motion", reduceMotionToggle.checked);
        localStorage.setItem("hmd-reduce-motion", reduceMotionToggle.checked ? "1" : "0");
      });
    }

    await tryLoadStatsFromApi();
    runCounters();

    const initial = safeRoute(routeFromHash());
    setActiveNav(initial);
    setActivePage(initial);
    await loadRouteData(initial);
  })();

  window.addEventListener("hashchange", () => {
    const r = safeRoute(routeFromHash());
    navigate(r, { updateHash: false });
  });

  // ---------- Simple interactions ----------
  // Appointments list: click to toggle completion status.
  // Delegated to document so it works for both lists.
  document.addEventListener("click", (e) => {
    const item = e.target.closest(".list__item");
    if (!item) return;

    const list = item.closest("[data-appointments-list='1']");
    if (!list) return;

    const pill = item.querySelector(".pill");
    if (!pill) return;

    const originalText = pill.getAttribute("data-original-text") || pill.textContent;
    const originalClass = pill.getAttribute("data-original-class") ||
      (pill.classList.contains("pill--ok")
        ? "pill--ok"
        : pill.classList.contains("pill--warn")
          ? "pill--warn"
          : "pill--info");

    pill.setAttribute("data-original-text", originalText);
    pill.setAttribute("data-original-class", originalClass);

    const isDone = pill.classList.contains("pill--done");
    pill.classList.remove("pill--ok", "pill--warn", "pill--info", "pill--done");

    if (isDone) {
      pill.classList.add(originalClass);
      pill.textContent = originalText;
    } else {
      pill.classList.add("pill--done");
      pill.textContent = "Completed";
    }
  });

  // Billing: click a bill row to load items
  const billingTable = $("#billingTable");
  if (billingTable) {
    billingTable.addEventListener("click", async (e) => {
      const row = e.target.closest("tr[data-bill-id]");
      if (!row) return;
      const billId = row.getAttribute("data-bill-id");
      const billNo = row.querySelector("td")?.textContent?.trim() || "Bill";

      selectedBillId = Number(billId);
      selectedBillNo = billNo;

      try {
        const items = await fetchJson(`/api/billing/items?billId=${encodeURIComponent(billId)}`);
        renderBillingItems(billNo, items);
      } catch {
        // ignore
      }
    });
  }

  // Create: Patients
  if (addPatientForm) {
    addPatientForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setHint(addPatientMsg, "Saving…", "info");

      const fd = new FormData(addPatientForm);
      const payload = {
        full_name: String(fd.get("full_name") || "").trim(),
        patient_code: String(fd.get("patient_code") || "").trim(),
        gender: String(fd.get("gender") || "").trim(),
        status: String(fd.get("status") || "").trim(),
        phone: String(fd.get("phone") || "").trim(),
        dob: String(fd.get("dob") || "").trim(),
      };
      if (!payload.patient_code) delete payload.patient_code;
      if (!payload.gender) delete payload.gender;
      if (!payload.phone) delete payload.phone;
      if (!payload.dob) delete payload.dob;

      try {
        const created = await postJson("/api/patients", payload);
        setHint(addPatientMsg, `Created ${created.patient_code}. Refreshing…`, "ok");
        addPatientForm.reset();
        await loadRouteData("patients");
        await tryLoadStatsFromApi();
        runCounters();
      } catch (err) {
        setHint(addPatientMsg, String(err?.message || "Failed to create patient"), "warn");
      }
    });
  }

  // Create: Doctors
  if (addDoctorForm) {
    addDoctorForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setHint(addDoctorMsg, "Saving…", "info");

      const fd = new FormData(addDoctorForm);
      const payload = {
        full_name: String(fd.get("full_name") || "").trim(),
        department_id: Number(fd.get("department_id") || 0),
        status: String(fd.get("status") || "").trim(),
        specialty: String(fd.get("specialty") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        phone: String(fd.get("phone") || "").trim(),
      };
      if (!payload.specialty) delete payload.specialty;
      if (!payload.email) delete payload.email;
      if (!payload.phone) delete payload.phone;

      try {
        await postJson("/api/doctors", payload);
        setHint(addDoctorMsg, "Doctor created. Refreshing…", "ok");
        addDoctorForm.reset();
        await loadRouteData("doctors");
        await tryLoadStatsFromApi();
        runCounters();
      } catch (err) {
        setHint(addDoctorMsg, String(err?.message || "Failed to create doctor"), "warn");
      }
    });
  }

  // Create: Bills
  if (addBillForm) {
    addBillForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setHint(addBillMsg, "Saving…", "info");

      const fd = new FormData(addBillForm);
      const payload = {
        patient_id: Number(fd.get("patient_id") || 0),
        currency: String(fd.get("currency") || "DZD").trim(),
        status: String(fd.get("status") || "unpaid").trim(),
        bill_no: String(fd.get("bill_no") || "").trim(),
      };
      if (!payload.bill_no) delete payload.bill_no;

      try {
        const created = await postJson("/api/billing", payload);
        selectedBillId = Number(created.id);
        selectedBillNo = String(created.bill_no || "");
        setHint(addBillMsg, `Created ${selectedBillNo}. Refreshing…`, "ok");
        addBillForm.reset();
        await loadRouteData("billing");
      } catch (err) {
        setHint(addBillMsg, String(err?.message || "Failed to create bill"), "warn");
      }
    });
  }

  // Create: Bill items
  if (addBillItemForm) {
    addBillItemForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedBillId) {
        setHint(addBillItemMsg, "Select a bill first (click a bill row).", "warn");
        return;
      }
      setHint(addBillItemMsg, "Saving…", "info");

      const fd = new FormData(addBillItemForm);
      const payload = {
        bill_id: selectedBillId,
        description: String(fd.get("description") || "").trim(),
        qty: Number(fd.get("qty") || 1),
        unit_price: Number(fd.get("unit_price") || 0),
      };

      try {
        await postJson("/api/billing/items", payload);
        setHint(addBillItemMsg, `Item added to ${selectedBillNo || "bill"}. Refreshing…`, "ok");
        addBillItemForm.reset();
        // Refresh list (for totals) and reload items
        const rows = await fetchJson("/api/billing");
        renderBilling(rows);
        const items = await fetchJson(`/api/billing/items?billId=${encodeURIComponent(selectedBillId)}`);
        renderBillingItems(selectedBillNo, items);
      } catch (err) {
        setHint(addBillItemMsg, String(err?.message || "Failed to add item"), "warn");
      }
    });
  }

  // Refresh buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-refresh]");
    if (!btn) return;
    const route = btn.getAttribute("data-refresh");
    if (!route) return;
    loadRouteData(route);
  });

  // Logout (UI-only)
  const doLogout = () => {
    const ok = window.confirm("Logout from the dashboard?");
    if (!ok) return;
    // Demo behavior: reset hash and reload.
    localStorage.removeItem("hmd-session");
    location.hash = "#dashboard";
    location.reload();
  };

  if (logoutBtn) logoutBtn.addEventListener("click", doLogout);

  // Notification demo: clicking clears the badge.
  if (notificationBtn && notificationBadge) {
    notificationBtn.addEventListener("click", () => {
      notificationBadge.textContent = "0";
      notificationBadge.setAttribute("aria-label", "0 unread notifications");
      notificationBadge.style.display = "none";
    });
  }

  // Add button demo (no backend): gently re-run counters to simulate refresh.
  const addAppointmentBtn = $("#addAppointmentBtn");
  if (addAppointmentBtn) {
    addAppointmentBtn.addEventListener("click", () => {
      runCounters();
    });
  }
})();
