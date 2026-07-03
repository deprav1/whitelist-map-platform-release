const fallbackData = {
  updated_at: "2026-07-02T18:50:00+03:00",
  source: "WhiteS moderated public reports",
  disclaimer: "Пользовательские отметки, не официальные данные. Проверяйте свежесть и уровень уверенности.",
  reports: [
    {
      id: "report-001",
      region: "Москва",
      city_or_area: "ЮАО",
      operator: "МТС",
      network_type: "Мобильный интернет",
      problem_type: "Работает только белый список",
      incident_category: "whitelist-only",
      checked_services: ["Карты / навигация", "Такси", "Банки / оплата"],
      checked_at: "2026-07-02T18:30:00+03:00",
      confidence: "Проверил сам",
      freshness: "now",
      summary: "Карты и такси не открывались. Банковское приложение работало.",
      approx_location: { lat: 55.62, lon: 37.61, precision: "district" }
    },
    {
      id: "report-002",
      region: "Краснодарский край",
      city_or_area: "Краснодар",
      operator: "МегаФон",
      network_type: "Мобильный интернет",
      problem_type: "Полное отключение",
      incident_category: "internet-shutdown",
      checked_services: ["Telegram", "Карты / навигация", "Зарубежные сайты"],
      checked_at: "2026-07-02T17:40:00+03:00",
      confidence: "Подтверждено несколькими людьми",
      freshness: "now",
      summary: "Мобильный интернет не работал, связь и SMS были доступны.",
      approx_location: { lat: 45.04, lon: 38.97, precision: "city" }
    },
    {
      id: "report-003",
      region: "Республика Татарстан",
      city_or_area: "Казань",
      operator: "Билайн",
      network_type: "Домашний интернет",
      problem_type: "Доступ восстановился",
      incident_category: "restored",
      checked_services: ["YouTube", "Зарубежные сайты", "Российские соцсети"],
      checked_at: "2026-07-01T21:15:00+03:00",
      confidence: "Проверил сам",
      freshness: "today",
      summary: "После вечернего сбоя доступ восстановился, страницы открывались стабильно.",
      approx_location: { lat: 55.79, lon: 49.12, precision: "city" }
    },
    {
      id: "report-004",
      region: "Ростовская область",
      city_or_area: "Ростов-на-Дону",
      operator: "Tele2",
      network_type: "Мобильный интернет",
      problem_type: "Не работают отдельные сервисы",
      incident_category: "partial-connectivity",
      checked_services: ["WhatsApp", "Telegram", "Банки / оплата"],
      checked_at: "2026-06-30T14:20:00+03:00",
      confidence: "Со слов знакомых",
      freshness: "recent",
      summary: "Мессенджеры работали нестабильно, банковские приложения открывались.",
      approx_location: { lat: 47.23, lon: 39.72, precision: "city" }
    }
  ]
};

const state = {
  data: fallbackData,
  dataUrl: "embedded public fallback",
  dataSavedAt: null,
  map: null,
  tileLayer: null,
  markerLayer: null,
  radiusLayer: null,
  markers: new Map(),
  selectedId: null,
  searchDebounceId: null,
  useTiles: true,
  filters: defaultFilters(),
  currentFormStep: 1,
  submitInProgress: false,
  reportApiSubmitInProgress: false,
  issueReportId: null,
  issueSubmitInProgress: false,
  issueApiSubmitInProgress: false
};

const categoryMeta = {
  "internet-shutdown": { className: "shutdown", color: "#c7473f", label: "Отключение" },
  "whitelist-only": { className: "whitelist", color: "#d98621", label: "Белый список" },
  "partial-connectivity": { className: "partial", color: "#c7682d", label: "Частично" },
  restored: { className: "restored", color: "#1f7a55", label: "Восстановлено" },
  "needs-verification": { className: "unknown", color: "#7a8292", label: "Проверка" }
};

const categoryWeight = {
  "internet-shutdown": 4,
  "whitelist-only": 3,
  "partial-connectivity": 2,
  "needs-verification": 1,
  restored: 0
};

const freshnessWeight = {
  now: 3,
  today: 2,
  recent: 1,
  stale: 0
};

const freshnessLabels = {
  now: "свежее",
  today: "сегодня",
  recent: "недавно",
  stale: "устарело"
};

const precisionRadius = {
  district: 4500,
  city: 14000,
  region: 55000
};

const dataSources = ["reports.json", "data/public-reports.json", "reports.sample.json"];
const cacheKey = "whites:last-public-data";
const noTilesKey = "whites:no-tiles";

const searchAliases = {
  спб: "санкт-петербург питер петербург",
  питер: "санкт-петербург спб петербург",
  "санкт-петербург": "спб питер петербург",
  петербург: "санкт-петербург спб питер",
  мегафон: "megafon",
  megafon: "мегафон",
  телега: "telegram телеграм",
  телеграм: "telegram телега",
  telegram: "телеграм телега",
  вацап: "whatsapp вотсап ватсап",
  вотсап: "whatsapp вацап ватсап",
  ватсап: "whatsapp вацап вотсап",
  whatsapp: "вацап вотсап ватсап",
  ютуб: "youtube",
  youtube: "ютуб",
  госы: "госуслуги",
  госуслуги: "госы",
  сбп: "банки оплата"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function applyRuntimeCapabilities() {
  const supportsBackdrop =
    typeof CSS !== "undefined" &&
    CSS.supports &&
    (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"));
  document.documentElement.classList.toggle("no-backdrop-filter", !supportsBackdrop);
}

function defaultFilters() {
  return {
    search: "",
    category: "all",
    problem: "all",
    operator: "all",
    service: "all",
    freshness: "all"
  };
}

function announce(message) {
  const liveRegion = $("#liveRegion");
  if (liveRegion) liveRegion.textContent = message;
}

const CONFIRMED_STORAGE_KEY = "whites:confirmed";
const DEVICE_ID_STORAGE_KEY = "whites:device-id";

function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

function confirmedReportIds() {
  try {
    const raw = localStorage.getItem(CONFIRMED_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function hasConfirmed(reportId) {
  return confirmedReportIds().has(reportId);
}

function rememberConfirmed(reportId) {
  try {
    const ids = confirmedReportIds();
    ids.add(reportId);
    localStorage.setItem(CONFIRMED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* приватный режим — обойдёмся без запоминания */
  }
}

function findReportById(reportId) {
  return (state.data.reports || []).find((item) => item.id === reportId);
}

async function confirmReport(reportId, buttonEl) {
  if (!reportId || hasConfirmed(reportId)) return;
  const report = findReportById(reportId);
  if (!report) return;

  // Оптимистично: инкремент и запоминание устройства до сетевого ответа.
  rememberConfirmed(reportId);
  report.confirmation_count = (Number(report.confirmation_count) || 0) + 1;
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.classList.add("is-confirmed");
    buttonEl.textContent = "Вы подтвердили";
  }
  updateConfirmationViews(reportId);
  announce(`Подтверждено: ${report.city_or_area}, ${report.operator}. Спасибо.`);

  // Лучшее усилие: сохранить на бэке (дедуп/rate-limit там же). Офлайн — остаётся локально.
  try {
    await postJson("api/confirm.php", { report_id: reportId, device_id: deviceId() });
  } catch {
    /* локальный инкремент уже показан — тихо игнорируем сетевую ошибку */
  }
}

function confirmationLabel(report) {
  return report.confirmation_count ? `${report.confirmation_count} подтвердили` : "";
}

function updateConfirmationViews(reportId) {
  const report = findReportById(reportId);
  if (!report) return;
  document
    .querySelectorAll(`[data-confirmation-count="${cssEscape(reportId)}"]`)
    .forEach((node) => {
      node.textContent = confirmationLabel(report);
      node.hidden = !report.confirmation_count;
    });
}

function cssEscape(value) {
  if (window.CSS && typeof CSS.escape === "function") return CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
}

function categoryFor(report) {
  return categoryMeta[report.incident_category] || categoryMeta["needs-verification"];
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "неизвестно";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function freshnessFor(report) {
  const checkedAt = new Date(report.checked_at);
  if (Number.isNaN(checkedAt.getTime())) return report.freshness || "stale";

  const ageMs = Date.now() - checkedAt.getTime();
  const ageHours = ageMs / 36e5;
  if (ageHours <= 3) return "now";
  if (ageHours <= 24) return "today";
  if (ageHours <= 168) return "recent";
  return "stale";
}

function normalizeText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Вес уверенности источника отметки (0..2) из свободного текста confidence.
function confidenceWeight(report) {
  const c = normalizeText(report.confidence);
  if (c.includes("несколькими")) return 2; // подтверждено несколькими людьми
  if (c.includes("проверил сам")) return 1; // проверил сам
  return 0; // со слов знакомых / не указано
}

// Единый индикатор доверия: свежесть × уверенность × подтверждения → 3 уровня.
function trustLevel(report) {
  const fresh = freshnessWeight[freshnessFor(report)] ?? 0; // 0..3
  const confidence = confidenceWeight(report); // 0..2
  const confirmations = Math.min(Number(report.confirmation_count) || 0, 10);
  const score = fresh + confidence + Math.min(confirmations / 2, 3); // 0..8
  if (score >= 5) return { key: "high", label: "высокая надёжность", className: "trust-high" };
  if (score >= 2.5) return { key: "medium", label: "средняя надёжность", className: "trust-medium" };
  return { key: "low", label: "требует проверки", className: "trust-low" };
}

function sortedReports(reports) {
  return [...reports].sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at));
}

function publishedReports() {
  return sortedReports(state.data.reports || []).filter((report) => !report.status || report.status === "published");
}

async function loadData() {
  for (const source of dataSources) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) continue;
      state.data = await response.json();
      state.dataUrl = source;
      state.dataSavedAt = new Date().toISOString();
      localStorage.setItem(cacheKey, JSON.stringify({ data: state.data, dataUrl: source, saved_at: state.dataSavedAt }));
      return;
    } catch {
      // Try the next known public export path.
    }
  }

  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached?.data?.reports?.length) {
      state.data = cached.data;
      state.dataUrl = `${cached.dataUrl || "cache"} (кэш)`;
      state.dataSavedAt = cached.saved_at || null;
      return;
    }
  } catch {
    localStorage.removeItem(cacheKey);
  }

  state.data = fallbackData;
  state.dataUrl = "embedded public fallback";
  state.dataSavedAt = null;
}

function fillSelect(element, values, allLabel) {
  element.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = allLabel;
  element.appendChild(all);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    element.appendChild(option);
  });
}

function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  ["search", "category", "problem", "operator", "service", "freshness"].forEach((key) => {
    const value = params.get(key);
    if (value) state.filters[key] = value;
  });
}

function hydrateSearchFromUrlEarly() {
  const searchInput = $("#searchInput");
  if (searchInput && state.filters.search) {
    searchInput.value = state.filters.search;
  }
}

function readRuntimePreferences() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("notiles") === "1") {
    state.useTiles = false;
    return;
  }
  const storedNoTiles = localStorage.getItem(noTilesKey);
  if (storedNoTiles === "1") {
    state.useTiles = false;
    return;
  }
  if (storedNoTiles === "0") {
    state.useTiles = true;
    return;
  }
  state.useTiles = !window.matchMedia("(max-width: 720px)").matches;
}

function writeFiltersToUrl() {
  const params = new URLSearchParams();
  Object.entries(state.filters).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value);
  });
  const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}

function setupFilters() {
  const reports = publishedReports();
  fillSelect($("#problemFilter"), unique(reports.map((report) => report.problem_type)), "Все проблемы");
  fillSelect($("#operatorFilter"), unique(reports.map((report) => report.operator)), "Все операторы");
  fillSelect($("#serviceFilter"), unique(reports.flatMap((report) => report.checked_services || [])), "Все сервисы");

  syncFilterControls();

  $("#searchInput").addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim();
    render({ fit: false });
    clearTimeout(state.searchDebounceId);
    state.searchDebounceId = setTimeout(() => fitMap(getFilteredReports(), false), 240);
  });

  document.querySelectorAll(".quick-filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.category = button.dataset.category || "all";
      syncFilterControls();
      render({ fit: true });
    });
  });

  ["problem", "operator", "service", "freshness"].forEach((key) => {
    $(`#${key}Filter`).addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      render({ fit: true });
    });
  });

  $("#resetFiltersButton").addEventListener("click", () => {
    resetAllFilters();
  });

  $("#resetMapButton").addEventListener("click", () => {
    fitMap(getFilteredReports(), true);
  });

  $("#resetContextButton").addEventListener("click", resetAllFilters);
  $("#shareButton").addEventListener("click", shareCurrentView);
  $("#tileModeButton").addEventListener("click", toggleTileMode);
  $("#clearLocalButton").addEventListener("click", clearLocalData);
  $("#reportButton").addEventListener("click", openReportDialog);
  $("#drawerReportButton").addEventListener("click", openReportDialog);
  $("#aboutDataButton").addEventListener("click", () => openDialog($("#aboutDialog")));

  $("#overflowToggle").addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = $("#overflowMenu");
    const isOpen = menu.classList.toggle("is-open");
    $("#overflowToggle").setAttribute("aria-expanded", String(isOpen));
    if (isOpen) {
      const firstItem = menu.querySelector("button");
      if (firstItem) firstItem.focus({ preventScroll: true });
    }
  });
  $("#overflowMenu")?.addEventListener("click", (event) => event.stopPropagation());

  document.addEventListener("click", () => {
    $("#overflowMenu").classList.remove("is-open");
    $("#overflowToggle").setAttribute("aria-expanded", "false");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const menu = $("#overflowMenu");
    if (!menu.classList.contains("is-open")) return;
    menu.classList.remove("is-open");
    $("#overflowToggle").setAttribute("aria-expanded", "false");
    $("#overflowToggle").focus({ preventScroll: true });
  });

  $("#footerAbout").addEventListener("click", () => openDialog($("#aboutDialog")));
  $("#footerRules").addEventListener("click", () => openDialog($("#rulesDialog")));
  $("#footerPrivacy").addEventListener("click", () => openDialog($("#privacyDialog")));

  $("#issueReason")?.addEventListener("change", updateIssueDraft);
  $("#issueComment")?.addEventListener("input", updateIssueDraft);
  $("#copyIssueDraftButton")?.addEventListener("click", copyIssueDraft);
  $("#sendIssueButton")?.addEventListener("click", submitIssueToModeration);
  $("#submitIssueButton")?.addEventListener("click", (event) => {
    const submitButton = event.currentTarget;
    event.preventDefault();
    if (state.issueSubmitInProgress) {
      return;
    }
    updateIssueDraft();
    const targetUrl = submitButton.href;
    state.issueSubmitInProgress = true;
    submitButton.setAttribute("aria-disabled", "true");
    submitButton.removeAttribute("href");
    openExternalUrl(targetUrl);
    const dialog = $("#issueDialog");
    if (dialog) {
      setTimeout(() => {
        if (dialog.close) dialog.close();
        else dialog.removeAttribute("open");
      }, 80);
    }
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-report-issue]");
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    openIssueDialog(trigger.dataset.reportIssue);
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-report-confirm]");
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    confirmReport(trigger.dataset.reportConfirm, trigger);
  });

  $("#prevStepButton").addEventListener("click", () => {
    if (state.currentFormStep > 1) {
      showFormStep(state.currentFormStep - 1);
    }
  });

  $("#nextStepButton").addEventListener("click", () => {
    const form = $("#reportDraftForm");
    const activeStep = form.querySelector(`.form-step[data-step="${state.currentFormStep}"]`);
    const inputs = activeStep.querySelectorAll("input[required], select[required]");
    let valid = true;
    inputs.forEach((input) => {
      if (!input.checkValidity()) {
        input.reportValidity();
        valid = false;
      }
    });
    if (!valid) return;

    if (state.currentFormStep < 3) {
      showFormStep(state.currentFormStep + 1);
      updateDraftOutput();
    }
  });
  $("#copyDraftButton").addEventListener("click", copyReportDraft);
  $("#sendModerationButton")?.addEventListener("click", submitReportToModeration);

  $("#submitFormButton").addEventListener("click", (event) => {
    const submitButton = event.currentTarget;
    event.preventDefault();
    if (state.submitInProgress) {
      return;
    }
    updateDraftOutput();
    const targetUrl = submitButton.href;
    state.submitInProgress = true;
    submitButton.setAttribute("aria-disabled", "true");
    submitButton.removeAttribute("href");
    openExternalUrl(targetUrl);
    const dialog = $("#reportDialog");
    if (dialog) {
      setTimeout(() => {
        if (dialog.close) dialog.close();
        else dialog.removeAttribute("open");
      }, 80);
    }
  });

  const pillsContainer = $("#servicePillsContainer");
  if (pillsContainer) {
    pillsContainer.addEventListener("click", (event) => {
      const button = event.target.closest(".service-pill");
      if (!button) return;
      
      button.classList.toggle("is-active");
      button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
      syncDraftServicesInput();
      updateDraftOutput();
    });
  }

  const operatorPillsContainer = $("#operatorPillsContainer");
  if (operatorPillsContainer) {
    operatorPillsContainer.addEventListener("click", (event) => {
      const button = event.target.closest(".operator-pill");
      if (!button) return;

      const wasActive = button.classList.contains("is-active");
      $$("#operatorPillsContainer .operator-pill").forEach((pill) => {
        pill.classList.remove("is-active");
        pill.setAttribute("aria-pressed", "false");
      });

      if (!wasActive) {
        button.classList.add("is-active");
        button.setAttribute("aria-pressed", "true");
        $("#draftOperator").value = button.dataset.value || "";
      } else {
        $("#draftOperator").value = "";
      }

      updateDraftOutput();
    });
  }

  $("#draftOperator")?.addEventListener("input", syncOperatorPills);

  $("#draftServicesOther")?.addEventListener("input", () => {
    syncDraftServicesInput();
    updateDraftOutput();
  });

  document.querySelectorAll("#reportDraftForm input, #reportDraftForm select, #reportDraftForm textarea").forEach((field) => {
    field.addEventListener("input", updateDraftOutput);
    field.addEventListener("change", updateDraftOutput);
  });

  $("#showMapTab").addEventListener("click", () => setMobileView("map"));
  $("#showListTab").addEventListener("click", () => setMobileView("list"));
  updateTileModeButton();
}

function syncFilterControls() {
  $("#searchInput").value = state.filters.search;
  syncSelectFilter("problem", "#problemFilter");
  syncSelectFilter("operator", "#operatorFilter");
  syncSelectFilter("service", "#serviceFilter");
  syncSelectFilter("freshness", "#freshnessFilter");
  updateQuickFilters();
}

function syncSelectFilter(key, selector) {
  const element = $(selector);
  const hasValue = [...element.options].some((option) => option.value === state.filters[key]);
  if (!hasValue) state.filters[key] = "all";
  element.value = state.filters[key];
}

function resetAllFilters() {
  state.filters = defaultFilters();
  syncFilterControls();
  render({ fit: true });
  announce("Фильтры сброшены");
}

function clearFilter(key) {
  state.filters[key] = key === "search" ? "" : "all";
  syncFilterControls();
  render({ fit: true });
  announce("Фильтр снят");
}

function updateQuickFilters() {
  const buttons = [...document.querySelectorAll(".quick-filter")];
  if (!buttons.some((button) => button.dataset.category === state.filters.category)) {
    state.filters.category = "all";
  }
  buttons.forEach((button) => {
    const isActive = button.dataset.category === state.filters.category;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setMobileView(view) {
  document.body.classList.toggle("show-map", view === "map");
  document.body.classList.toggle("show-list", view === "list");
  $("#showMapTab").classList.toggle("is-active", view === "map");
  $("#showListTab").classList.toggle("is-active", view === "list");
  $("#showMapTab").setAttribute("aria-pressed", String(view === "map"));
  $("#showListTab").setAttribute("aria-pressed", String(view === "list"));
  if (view === "map" && state.map) {
    setTimeout(() => state.map.invalidateSize(), 40);
  }
}

function setupResponsiveView() {
  const mobileQuery = window.matchMedia("(max-width: 720px)");
  const applyView = () => setMobileView(mobileQuery.matches ? "list" : "map");
  applyView();
  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener("change", applyView);
  } else if (mobileQuery.addListener) {
    mobileQuery.addListener(applyView);
  }
}

function openDialog(dialog) {
  if (dialog.showModal) {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function openExternalUrl(url) {
  window.open(url, "_blank");
}

function showFormStep(stepNum) {
  const form = $("#reportDraftForm");
  if (!form) return;
  const steps = form.querySelectorAll(".form-step");
  steps.forEach((step) => {
    const active = parseInt(step.dataset.step) === stepNum;
    step.classList.toggle("is-active", active);
    step.setAttribute("aria-hidden", String(!active));
  });

  const progressBar = $("#formProgressBar");
  if (progressBar) {
    progressBar.style.width = `${(stepNum / steps.length) * 100}%`;
    progressBar.setAttribute("aria-valuemax", String(steps.length));
    progressBar.setAttribute("aria-valuenow", String(stepNum));
    progressBar.setAttribute("aria-label", `Шаг ${stepNum} из ${steps.length}`);
  }

  $("#prevStepButton").style.display = stepNum === 1 ? "none" : "inline-flex";
  $("#nextStepButton").style.display = stepNum === steps.length ? "none" : "inline-flex";
  $("#sendModerationButton").style.display = stepNum === steps.length ? "inline-flex" : "none";
  $("#submitFormButton").style.display = stepNum === steps.length ? "inline-flex" : "none";
  $("#copyDraftButton").style.display = stepNum === steps.length ? "inline-flex" : "none";

  state.currentFormStep = stepNum;
  announce(`Шаг ${stepNum} из ${steps.length}`);

  const activeStep = form.querySelector(`.form-step[data-step="${stepNum}"]`);
  const firstField = activeStep?.querySelector("input, select, textarea, button");
  if (firstField) {
    setTimeout(() => firstField.focus({ preventScroll: true }), 40);
  }
}

function openReportDialog() {
  resetReportForm();
  const reports = getFilteredReports();
  const latest = reports[0];
  if (latest) {
    $("#draftArea").value = latest.city_or_area || latest.region || "";
    $("#draftOperator").value = latest.operator || "";
    syncOperatorPills();
  }
  updateDraftOutput();
  showFormStep(1);
  openDialog($("#reportDialog"));
}

function resetReportForm() {
  const form = $("#reportDraftForm");
  if (!form) return;
  form.reset();
  $$("#servicePillsContainer .service-pill").forEach((pill) => {
    pill.classList.remove("is-active");
    pill.setAttribute("aria-pressed", "false");
  });
  $$("#operatorPillsContainer .operator-pill").forEach((pill) => {
    pill.classList.remove("is-active");
    pill.setAttribute("aria-pressed", "false");
  });
  const servicesInput = $("#draftServices");
  if (servicesInput) servicesInput.value = "";
  const reportStatus = $("#reportSubmitStatus");
  if (reportStatus) {
    reportStatus.textContent = "";
    reportStatus.className = "form-status";
  }
  const sendButton = $("#sendModerationButton");
  if (sendButton) {
    sendButton.disabled = false;
    sendButton.textContent = "Отправить";
  }
  $("#copyDraftButton").textContent = "Скопировать текст";
  const submitButton = $("#submitFormButton");
  submitButton.disabled = false;
  submitButton.removeAttribute("aria-disabled");
  state.submitInProgress = false;
  state.reportApiSubmitInProgress = false;
}

function reportById(id) {
  return publishedReports().find((report) => report.id === id);
}

function openIssueDialog(reportId) {
  const report = reportById(reportId);
  if (!report) return;
  state.issueReportId = report.id;
  resetIssueForm(report);
  updateIssueDraft();
  openDialog($("#issueDialog"));
  announce(`Открыта жалоба на отметку ${report.id}`);
}

function resetIssueForm(report) {
  const category = categoryFor(report);
  $("#issueReportSummary").value = `${report.id} · ${report.city_or_area}, ${report.operator} · ${category.label} · ${formatTime(report.checked_at)}`;
  $("#issueReason").selectedIndex = 0;
  $("#issueComment").value = "";
  $("#issueCommentCounter").textContent = "0 / 400";
  $("#copyIssueDraftButton").textContent = "Скопировать";
  const issueStatus = $("#issueSubmitStatus");
  if (issueStatus) {
    issueStatus.textContent = "";
    issueStatus.className = "form-status";
  }
  const sendButton = $("#sendIssueButton");
  if (sendButton) {
    sendButton.disabled = false;
    sendButton.textContent = "Отправить жалобу";
  }
  const submitButton = $("#submitIssueButton");
  submitButton.removeAttribute("aria-disabled");
  state.issueSubmitInProgress = false;
  state.issueApiSubmitInProgress = false;
}

function updateIssueDraft() {
  const report = reportById(state.issueReportId);
  if (!report) return;
  const category = categoryFor(report);
  const comment = draftValue("#issueComment");
  $("#issueCommentCounter").textContent = `${comment.length} / 400`;
  const lines = [
    "WhiteS: жалоба на публичную отметку",
    `ID отметки: ${report.id}`,
    `Место: ${report.region}, ${report.city_or_area}`,
    `Оператор: ${report.operator}`,
    `Статус: ${category.label}`,
    `Время проверки: ${formatTime(report.checked_at)}`,
    `Причина: ${$("#issueReason").value}`,
    `Комментарий: ${comment || "нет"}`,
    "",
    "Пожалуйста, проверьте запись. Я не добавляю свои контакты, точный адрес или новые персональные данные."
  ];
  $("#issueDraftOutput").value = lines.join("\n");
  $("#submitIssueButton").href = `https://t.me/WhiteS_Bot?text=${encodeURIComponent($("#issueDraftOutput").value)}`;
}

async function copyIssueDraft() {
  updateIssueDraft();
  try {
    await navigator.clipboard.writeText($("#issueDraftOutput").value);
    $("#copyIssueDraftButton").textContent = "Скопировано";
    announce("Жалоба скопирована");
  } catch {
    $("#copyIssueDraftButton").textContent = "Скопируйте вручную";
    announce("Не удалось скопировать жалобу автоматически");
  }
  setTimeout(() => {
    $("#copyIssueDraftButton").textContent = "Скопировать";
  }, 1400);
}

async function submitIssueToModeration() {
  if (state.issueApiSubmitInProgress) return;
  const report = reportById(state.issueReportId);
  if (!report) return;

  updateIssueDraft();
  state.issueApiSubmitInProgress = true;
  const button = $("#sendIssueButton");
  const status = $("#issueSubmitStatus");
  button.disabled = true;
  button.textContent = "Отправляем...";
  setFormStatus(status, "Отправляем жалобу в модерацию.", "pending");

  try {
    const response = await postJson("api/complaint.php", {
      report_id: report.id,
      reason: $("#issueReason").value,
      comment: draftValue("#issueComment"),
    });
    setFormStatus(status, `Жалоба принята. Номер: ${response.id}.`, "success");
    button.textContent = "Жалоба отправлена";
    announce("Жалоба отправлена в модерацию");
  } catch (error) {
    button.disabled = false;
    button.textContent = "Отправить жалобу";
    setFormStatus(status, "Не удалось сохранить жалобу. Скопируйте текст или отправьте через Telegram.", "error");
    announce("Не удалось отправить жалобу");
  } finally {
    state.issueApiSubmitInProgress = false;
  }
}

function syncOperatorPills() {
  const operator = draftValue("#draftOperator");
  $$("#operatorPillsContainer .operator-pill").forEach((pill) => {
    const isActive = pill.dataset.value === operator;
    pill.classList.toggle("is-active", isActive);
    pill.setAttribute("aria-pressed", String(isActive));
  });
}

function splitServices(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function syncDraftServicesInput() {
  const servicesInput = $("#draftServices");
  if (!servicesInput) return;
  const pillValues = $$("#servicePillsContainer .service-pill.is-active").map((pill) => pill.dataset.value);
  const manualValues = splitServices($("#draftServicesOther")?.value || "");
  servicesInput.value = [...new Set([...pillValues, ...manualValues])].join(", ");
}

function draftValue(selector) {
  return $(selector).value.trim();
}

function updateDraftOutput() {
  syncDraftServicesInput();
  const checkedAt = new Date().toLocaleString("ru-RU");
  const summary = draftValue("#draftSummary");
  $("#draftSummaryCounter").textContent = `${summary.length} / 500`;
  const lines = [
    "WhiteS",
    `Место: ${draftValue("#draftArea") || "не указано"}`,
    `Оператор: ${draftValue("#draftOperator") || "не указано"}`,
    `Сеть: ${$("#draftNetwork").value}`,
    `Проблема: ${$("#draftProblem").value}`,
    `Сервисы: ${draftValue("#draftServices") || "не указано"}`,
    `Когда: ${checkedAt}`,
    `Уверенность: ${$("#draftConfidence").value}`,
    `Комментарий: ${summary || "нет"}`,
    "",
    "Без личных данных."
  ];
  $("#draftOutput").value = lines.join("\n");
  const submitButton = $("#submitFormButton");
  if (submitButton) {
    submitButton.href = `https://t.me/WhiteS_Bot?text=${encodeURIComponent($("#draftOutput").value)}`;
  }
}

function reportPayloadFromForm() {
  syncDraftServicesInput();
  return {
    area: draftValue("#draftArea"),
    operator: draftValue("#draftOperator"),
    network_type: $("#draftNetwork").value,
    problem_type: $("#draftProblem").value,
    services: splitServices(draftValue("#draftServices")),
    checked_at: new Date().toISOString(),
    confidence: $("#draftConfidence").value,
    summary: draftValue("#draftSummary"),
  };
}

async function submitReportToModeration() {
  if (state.reportApiSubmitInProgress) return;
  updateDraftOutput();

  const payload = reportPayloadFromForm();
  const button = $("#sendModerationButton");
  const status = $("#reportSubmitStatus");
  state.reportApiSubmitInProgress = true;
  button.disabled = true;
  button.textContent = "Отправляем...";
  setFormStatus(status, "Отправляем отчет в премодерацию.", "pending");

  try {
    const response = await postJson("api/submit.php", payload);
    setFormStatus(status, `Отчет принят в премодерацию. Номер: ${response.id}.`, "success");
    button.textContent = "Отчет отправлен";
    announce("Отчет отправлен в премодерацию");
  } catch (error) {
    button.disabled = false;
    button.textContent = "Отправить";
    setFormStatus(status, "Не удалось сохранить отчет. Скопируйте текст или отправьте через Telegram.", "error");
    announce("Не удалось отправить отчет");
  } finally {
    state.reportApiSubmitInProgress = false;
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function setFormStatus(element, message, tone) {
  if (!element) return;
  element.textContent = message;
  element.className = `form-status is-${tone}`;
}

async function copyReportDraft() {
  updateDraftOutput();
  try {
    await navigator.clipboard.writeText($("#draftOutput").value);
    $("#copyDraftButton").textContent = "Скопировано";
    announce("Текст отчета скопирован");
  } catch {
    $("#copyDraftButton").textContent = "Скопируйте вручную";
    announce("Не удалось скопировать автоматически");
  }
  setTimeout(() => {
    $("#copyDraftButton").textContent = "Скопировать текст";
  }, 1400);
}

function updateTileModeButton() {
  $("#tileModeButton").textContent = state.useTiles ? "Фон карты вкл" : "Фон карты выкл";
  $("#tileModeButton").setAttribute("aria-pressed", String(state.useTiles));
}

function setTileWarning(message) {
  const warning = $("#tileWarning");
  if (!warning) return;
  if (message) warning.textContent = message;
  warning.hidden = false;
}

function updateConnectivityWarning() {
  const warning = $("#tileWarning");
  if (!warning) return;
  if (!navigator.onLine) {
    setTileWarning("Связь нестабильна: показываем последний доступный снимок. Список, фильтры и точки продолжают работать.");
    return;
  }
  if (!state.useTiles) {
    setTileWarning("Фон карты отключен: это экономит трафик и уменьшает внешние запросы. Список, фильтры и точки продолжают работать.");
    return;
  }
  warning.hidden = true;
}

function toggleTileMode() {
  state.useTiles = !state.useTiles;
  localStorage.setItem(noTilesKey, state.useTiles ? "0" : "1");
  updateTileModeButton();

  if (!state.map) return;
  if (state.useTiles) {
    addTileLayer();
    $("#tileWarning").hidden = true;
    $(".map-silhouette")?.style && ($(".map-silhouette").style.display = "none");
  } else {
    if (state.tileLayer) {
      state.map.removeLayer(state.tileLayer);
      state.tileLayer = null;
    }
    setTileWarning("Фон карты отключен: это экономит трафик и уменьшает внешние запросы. Список, фильтры и точки продолжают работать.");
    $(".map-silhouette")?.style && ($(".map-silhouette").style.display = "block");
  }
}

function clearLocalData() {
  localStorage.removeItem(cacheKey);
  localStorage.removeItem(noTilesKey);
  $("#clearLocalButton").textContent = "Очищено";
  announce("Локальный кэш очищен");
  setTimeout(() => {
    $("#clearLocalButton").textContent = "Очистить";
  }, 1400);
}

function setupMap() {
  if (!window.L) {
    setTileWarning("Карта открыта в облегченном режиме: список, фильтры и точки доступны без внешнего фона.");
    const silhouette = $(".map-silhouette");
    if (silhouette) silhouette.style.display = "block";
    return;
  }

  state.map = L.map("map", {
    center: [55.75, 37.62],
    zoom: 4,
    minZoom: 3,
    maxZoom: 12,
    zoomControl: false,
    attributionControl: false
  });

  L.control.zoom({ position: "bottomright" }).addTo(state.map);
  L.control
    .attribution({ prefix: false, position: "bottomleft" })
    .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>')
    .addTo(state.map);

  if (state.useTiles) {
    addTileLayer();
  } else {
    setTileWarning("Фон карты отключен: это экономит трафик и уменьшает внешние запросы. Список, фильтры и точки продолжают работать.");
    $(".map-silhouette")?.style && ($(".map-silhouette").style.display = "block");
  }

  state.radiusLayer = L.layerGroup().addTo(state.map);
  state.markerLayer = L.layerGroup().addTo(state.map);
  state.map.on("zoomend", () => renderMarkers(getFilteredReports()));
}

function addTileLayer() {
  if (!state.map || state.tileLayer) return;

  const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    minZoom: 3,
    maxZoom: 18,
    subdomains: 'abcd'
  });

  let tileErrorShown = false;
  tiles.on("tileerror", () => {
    if (tileErrorShown) return;
    tileErrorShown = true;
    setTileWarning("Фон карты временно не загрузился. Список, фильтры и точки продолжают работать.");
  });

  tiles.addTo(state.map);
  state.tileLayer = tiles;
}

function getFilteredReports() {
  const searchString = normalizeText(state.filters.search);
  const searchTokens = searchString.split(" ").filter(Boolean);

  return publishedReports().filter((report) => {
    if (state.filters.category !== "all" && report.incident_category !== state.filters.category) return false;
    if (state.filters.problem !== "all" && report.problem_type !== state.filters.problem) return false;
    if (state.filters.operator !== "all" && report.operator !== state.filters.operator) return false;
    if (state.filters.service !== "all" && !(report.checked_services || []).includes(state.filters.service)) return false;
    if (state.filters.freshness !== "all" && freshnessFor(report) !== state.filters.freshness) return false;
    if (searchTokens.length === 0) return true;

    const haystack = [
      report.region,
      report.city_or_area,
      report.operator,
      report.network_type,
      report.problem_type,
      report.incident_category,
      report.confidence,
      report.confirmation_count,
      report.approx_location?.precision,
      report.summary,
      ...(report.checked_services || [])
    ].join(" ");

    const normalizedHaystack = normalizeText(haystack);

    return searchTokens.every((token) => {
      const synonyms = [token];
      const aliasString = searchAliases[token];
      if (aliasString) {
        aliasString.split(" ").forEach((sym) => {
          if (sym && !synonyms.includes(sym)) synonyms.push(sym);
        });
      }
      return synonyms.some((synonym) => normalizedHaystack.includes(synonym));
    });
  });
}

function popupHtml(report) {
  const category = categoryFor(report);
  const precisionText = report.approx_location?.precision ? `точность: ${report.approx_location.precision}` : "";
  const tags = [category.label, freshnessLabels[freshnessFor(report)], report.confidence, precisionText, ...(report.checked_services || []).slice(0, 4)]
    .filter(Boolean)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
  const confirmed = hasConfirmed(report.id);
  const trust = trustLevel(report);

  return `
    <h2 class="popup-title">${escapeHtml(report.city_or_area)}, ${escapeHtml(report.operator)}</h2>
    <p class="popup-meta">${escapeHtml(report.region)} · ${escapeHtml(report.network_type)} · ${escapeHtml(formatTime(report.checked_at))}</p>
    <p class="popup-trust"><span class="trust-badge ${trust.className}">${escapeHtml(trust.label)}</span></p>
    <p class="popup-text">${escapeHtml(report.summary)}</p>
    <div class="popup-tags">${tags}<span class="tag strong" data-confirmation-count="${escapeHtml(report.id)}"${report.confirmation_count ? "" : " hidden"}>${escapeHtml(confirmationLabel(report))}</span></div>
    <div class="popup-actions">
      <button class="confirm-button${confirmed ? " is-confirmed" : ""}" type="button" data-report-confirm="${escapeHtml(report.id)}"${confirmed ? " disabled" : ""}>${confirmed ? "Вы подтвердили" : "Я тоже это вижу"}</button>
      <button class="issue-report-button" type="button" data-report-issue="${escapeHtml(report.id)}">Пожаловаться</button>
    </div>
  `;
}

function worstCategory(reports) {
  return reports.reduce((worst, report) => {
    const current = report.incident_category || "needs-verification";
    return (categoryWeight[current] ?? 1) > (categoryWeight[worst] ?? 1) ? current : worst;
  }, "restored");
}

function averageLocation(reports) {
  const located = reports.filter((report) => report.approx_location);
  const lat = located.reduce((sum, report) => sum + report.approx_location.lat, 0) / located.length;
  const lon = located.reduce((sum, report) => sum + report.approx_location.lon, 0) / located.length;
  return [lat, lon];
}

function groupReportsForMap(reports) {
  if (!state.map || state.map.getZoom() >= 6) {
    return reports.map((report) => ({ type: "single", reports: [report] }));
  }

  const groups = new Map();
  reports
    .filter((report) => report.approx_location)
    .forEach((report) => {
      const key = report.region;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(report);
    });

  return [...groups.values()].map((items) => ({
    type: items.length > 1 ? "cluster" : "single",
    reports: items
  }));
}

function clusterPopupHtml(group) {
  const reports = group.reports;
  const first = reports[0];
  const category = categoryFor({ incident_category: worstCategory(reports) });
  const operators = unique(reports.map((report) => report.operator)).slice(0, 4).join(", ");
  const freshCount = reports.filter((report) => ["now", "today"].includes(freshnessFor(report))).length;

  return `
    <h2 class="popup-title">${escapeHtml(first.region)}</h2>
    <p class="popup-meta">${reports.length} отметок · ${escapeHtml(category.label)} · ${freshCount} свежих</p>
    <p class="popup-text">Операторы: ${escapeHtml(operators)}.</p>
    <div class="popup-tags">
      <span class="tag strong">${reports.length} отчетов</span>
      <span class="tag">${escapeHtml(category.label)}</span>
    </div>
  `;
}

function renderMarkers(reports) {
  if (!state.map) return;

  state.markerLayer.clearLayers();
  state.radiusLayer.clearLayers();
  state.markers.clear();

  groupReportsForMap(reports).forEach((group) => {
    if (group.type === "cluster") {
      const category = categoryMeta[worstCategory(group.reports)] || categoryMeta["needs-verification"];
      const marker = L.marker(averageLocation(group.reports), {
        icon: L.divIcon({
          className: "",
          html: `<span class="cluster-marker ${category.className}">${group.reports.length}</span>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        })
      });

      marker.bindPopup(clusterPopupHtml(group));
      marker.on("click", () => {
        const nextZoom = Math.max(state.map.getZoom() + 2, 6);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          state.map.setView(marker.getLatLng(), nextZoom);
        } else {
          state.map.flyTo(marker.getLatLng(), nextZoom, { duration: 0.45 });
        }
      });
      marker.addTo(state.markerLayer);
      return;
    }

    const report = group.reports[0];
    if (!report.approx_location) return;

      const category = categoryFor(report);
      const latLng = [report.approx_location.lat, report.approx_location.lon];
      const isActive = report.id === state.selectedId;
      const radiusMeters = precisionRadius[report.approx_location.precision] || precisionRadius.city;

      L.circle(latLng, {
        radius: radiusMeters,
        color: category.color,
        weight: 1,
        opacity: 0.28,
        fillColor: category.color,
        fillOpacity: 0.08,
        interactive: false
      }).addTo(state.radiusLayer);

      const marker = L.circleMarker(latLng, {
        radius: isActive ? 11 : 8,
        color: "#ffffff",
        weight: isActive ? 3 : 2,
        fillColor: category.color,
        fillOpacity: 0.95,
        opacity: 1,
        className: "map-circle-marker"
      });

      marker.bindPopup(popupHtml(report));
      marker.on("click", () => selectReport(report.id, false));
      marker.addTo(state.markerLayer);
      state.markers.set(report.id, marker);
  });
}

function fitMap(reports, force) {
  if (!state.map) return;

  const located = reports.filter((report) => report.approx_location);
  if (!located.length) {
    state.map.setView([55.75, 37.62], 4);
    return;
  }

  if (located.length === 1) {
    const point = located[0].approx_location;
    state.map.setView([point.lat, point.lon], force ? 8 : Math.max(state.map.getZoom(), 7));
    return;
  }

  const bounds = L.latLngBounds(located.map((report) => [report.approx_location.lat, report.approx_location.lon]));
  state.map.fitBounds(bounds.pad(0.28), { maxZoom: 8 });
}

function renderSummary(reports) {
  $("#totalCount").textContent = reports.length;
  $("#freshCount").textContent = reports.filter((report) => ["now", "today"].includes(freshnessFor(report))).length;
  $("#regionsCount").textContent = unique(reports.map((report) => report.region)).length;
  $("#shutdownCount").textContent = reports.filter((report) =>
    ["internet-shutdown", "whitelist-only", "partial-connectivity"].includes(report.incident_category)
  ).length;
  $("#updatedAt").textContent = `обновлено ${formatTime(state.data.updated_at)}`;
  const isCache = state.dataUrl.includes("кэш");
  const isFallback = state.dataUrl.includes("fallback");
  if (isCache) {
    $("#dataBadge").textContent = `${reportCountLabel(reports.length)} · кэш`;
    $("#sourceNote").textContent = `Показан последний сохраненный снимок (${formatTime(state.dataSavedAt)}). Публично видны только записи после модерации.`;
  } else if (isFallback) {
    $("#dataBadge").textContent = `${reportCountLabel(reports.length)} · резерв`;
    $("#sourceNote").textContent = "Основной файл данных не загрузился. Показан резервный публичный снимок без личных данных.";
  } else {
    $("#dataBadge").textContent = reportCountLabel(reports.length);
    $("#sourceNote").textContent = "Только модерированные отметки. Места примерные, личные данные не публикуются.";
  }

  const countBadge = $("#tabCount");
  if (countBadge) {
    countBadge.textContent = reports.length;
    countBadge.hidden = reports.length === 0;
  }
}

function pluralRu(value, forms) {
  const absolute = Math.abs(value) % 100;
  const last = absolute % 10;
  if (absolute > 10 && absolute < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

function reportCountLabel(value) {
  return `${value} ${pluralRu(value, ["отметка", "отметки", "отметок"])}`;
}

function freshCountLabel(value) {
  return `${value} ${pluralRu(value, ["свежая", "свежие", "свежих"])}`;
}

function regionHotspots(reports) {
  const groups = new Map();

  reports.forEach((report) => {
    const region = report.region || "Регион не указан";
    const category = report.incident_category || "needs-verification";
    const freshness = freshnessFor(report);
    const confirmation = Math.min(Number(report.confirmation_count) || 0, 12);
    const score = ((categoryWeight[category] ?? 1) + 1) * ((freshnessWeight[freshness] ?? 0) + 1) + confirmation / 2;

    if (!groups.has(region)) {
      groups.set(region, {
        region,
        count: 0,
        freshCount: 0,
        score: 0,
        worstCategory: category,
        operators: new Set()
      });
    }

    const group = groups.get(region);
    group.count += 1;
    group.score += score;
    group.freshCount += ["now", "today"].includes(freshness) ? 1 : 0;
    group.operators.add(report.operator);
    if ((categoryWeight[category] ?? 1) > (categoryWeight[group.worstCategory] ?? 1)) {
      group.worstCategory = category;
    }
  });

  return [...groups.values()].sort((a, b) => b.score - a.score || b.freshCount - a.freshCount || b.count - a.count);
}

function renderHotspots(reports) {
  const container = $("#hotspotsList");
  container.innerHTML = "";

  const hotspots = regionHotspots(reports).slice(0, 3);
  if (!hotspots.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Пока нет опубликованных отметок для сводки.";
    container.appendChild(empty);
    return;
  }

  hotspots.forEach((hotspot) => {
    const category = categoryMeta[hotspot.worstCategory] || categoryMeta["needs-verification"];
    const button = document.createElement("button");
    button.className = "hotspot-card";
    button.type = "button";
    button.classList.toggle("is-active", state.filters.search === hotspot.region);
    button.setAttribute("aria-label", `Показать регион ${hotspot.region}`);

    const main = document.createElement("span");
    main.className = "hotspot-main";

    const title = document.createElement("strong");
    title.textContent = hotspot.region;
    const meta = document.createElement("span");
    meta.textContent = `${reportCountLabel(hotspot.count)} · ${freshCountLabel(hotspot.freshCount)} · ${unique([...hotspot.operators]).join(", ")}`;
    main.append(title, meta);

    const badge = document.createElement("span");
    badge.className = `status-badge ${category.className}`;
    badge.textContent = category.label;

    button.append(main, badge);
    button.addEventListener("click", () => {
      state.filters.search = hotspot.region;
      syncFilterControls();
      render({ fit: true });
      if (window.matchMedia("(max-width: 720px)").matches) setMobileView("map");
      announce(`Показан регион ${hotspot.region}`);
    });
    container.appendChild(button);
  });
}

function operatorPulse(reports) {
  const groups = new Map();
  reports.forEach((report) => {
    const operator = report.operator || "Оператор не указан";
    const category = report.incident_category || "needs-verification";
    const freshness = freshnessFor(report);
    const score = ((categoryWeight[category] ?? 1) + 1) * ((freshnessWeight[freshness] ?? 0) + 1);

    if (!groups.has(operator)) {
      groups.set(operator, { operator, count: 0, score: 0, worstCategory: category });
    }

    const group = groups.get(operator);
    group.count += 1;
    group.score += score;
    if ((categoryWeight[category] ?? 1) > (categoryWeight[group.worstCategory] ?? 1)) {
      group.worstCategory = category;
    }
  });

  return [...groups.values()].sort((a, b) => b.score - a.score || b.count - a.count || a.operator.localeCompare(b.operator, "ru"));
}

function renderOperatorPulse(reports) {
  const container = $("#operatorPulse");
  container.innerHTML = "";

  operatorPulse(reports).slice(0, 7).forEach((item) => {
    const category = categoryMeta[item.worstCategory] || categoryMeta["needs-verification"];
    const button = document.createElement("button");
    button.className = "operator-chip";
    button.type = "button";
    button.classList.toggle("is-active", state.filters.operator === item.operator);
    button.setAttribute("aria-label", `Показать оператора ${item.operator}`);

    const dot = document.createElement("span");
    dot.className = `dot ${category.className}`;
    const label = document.createElement("span");
    label.textContent = item.operator;
    const count = document.createElement("small");
    count.textContent = reportCountLabel(item.count);

    button.append(dot, label, count);
    button.addEventListener("click", () => {
      state.filters.operator = item.operator;
      syncFilterControls();
      render({ fit: true });
      announce(`Показан оператор ${item.operator}`);
    });
    container.appendChild(button);
  });
}

function filterLabels() {
  const labels = [];
  if (state.filters.search) labels.push({ key: "search", label: `поиск: ${state.filters.search}` });
  if (state.filters.category !== "all") labels.push({ key: "category", label: categoryMeta[state.filters.category]?.label || state.filters.category });
  if (state.filters.problem !== "all") labels.push({ key: "problem", label: state.filters.problem });
  if (state.filters.operator !== "all") labels.push({ key: "operator", label: state.filters.operator });
  if (state.filters.service !== "all") labels.push({ key: "service", label: state.filters.service });
  if (state.filters.freshness !== "all") labels.push({ key: "freshness", label: freshnessLabels[state.filters.freshness] || state.filters.freshness });
  return labels;
}

function renderActiveFilters() {
  const container = $("#activeFilters");
  const labels = filterLabels();
  container.innerHTML = "";
  container.classList.toggle("has-filters", labels.length > 0);
  labels.forEach((item) => {
    const chip = document.createElement("button");
    chip.className = "filter-chip";
    chip.type = "button";
    chip.setAttribute("aria-label", `Снять фильтр ${item.label}`);
    chip.textContent = item.label;

    const remove = document.createElement("span");
    remove.className = "chip-remove";
    remove.setAttribute("aria-hidden", "true");
    remove.textContent = "×";
    chip.appendChild(remove);

    chip.addEventListener("click", () => clearFilter(item.key));
    container.appendChild(chip);
  });
}

function renderList(reports) {
  const list = $("#reportsList");
  const template = $("#reportTemplate");
  list.setAttribute("aria-busy", "true");
  list.innerHTML = "";

  if (!reports.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const text = document.createElement("p");
    text.textContent = "По выбранным фильтрам пока нет опубликованных отметок. Проверьте другой оператор или добавьте наблюдение после проверки.";
    const reset = document.createElement("button");
    reset.className = "ghost-button";
    reset.type = "button";
    reset.textContent = "Сбросить фильтры";
    reset.addEventListener("click", () => $("#resetFiltersButton").click());
    const report = document.createElement("button");
    report.className = "primary-button";
    report.type = "button";
    report.textContent = "Сообщить о сбое";
    report.addEventListener("click", openReportDialog);
    empty.append(text, report, reset);
    list.appendChild(empty);
    list.setAttribute("aria-busy", "false");
    return;
  }

  const fragment = document.createDocumentFragment();

  reports.forEach((report) => {
    const node = template.content.cloneNode(true);
    const row = node.querySelector(".report-row");
    const category = categoryFor(report);
    const tags = [report.confidence, ...(report.checked_services || []).slice(0, 2)].filter(Boolean);

    const trust = trustLevel(report);

    row.dataset.reportId = report.id;
    const isActive = report.id === state.selectedId;
    row.classList.toggle("is-active", isActive);
    row.classList.toggle("is-stale", freshnessFor(report) === "stale");
    if (isActive) row.setAttribute("aria-current", "true");
    row.setAttribute(
      "aria-label",
      `${report.city_or_area}, ${report.operator}. ${category.label}. ${freshnessLabels[freshnessFor(report)]}. ${report.confidence}. ${report.summary}`
    );
    row.querySelector(".row-status").classList.add(category.className);
    row.querySelector(".row-status").setAttribute("aria-label", category.label);
    row.querySelector(".row-title").textContent = `${report.city_or_area}, ${report.operator}`;
    row.querySelector(".row-status-label").textContent = category.label;
    const trustBadge = row.querySelector(".trust-badge");
    trustBadge.textContent = trust.label;
    trustBadge.classList.add(trust.className);
    trustBadge.setAttribute("title", "Надёжность: свежесть, уверенность источника и подтверждения");
    row.querySelector(".row-meta").textContent = `${report.region} · ${report.network_type} · ${formatTime(report.checked_at)} · ${freshnessLabels[freshnessFor(report)]}`;
    row.querySelector(".row-summary").textContent = report.summary;
    row.querySelector(".issue-report-button").dataset.reportIssue = report.id;

    const confirmButton = row.querySelector(".confirm-button");
    confirmButton.dataset.reportConfirm = report.id;
    if (hasConfirmed(report.id)) {
      confirmButton.disabled = true;
      confirmButton.classList.add("is-confirmed");
      confirmButton.textContent = "Вы подтвердили";
    }

    const tagWrap = row.querySelector(".row-tags");
    tags.forEach((value) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = value;
      tagWrap.appendChild(tag);
    });
    const confirmTag = document.createElement("span");
    confirmTag.className = "tag strong";
    confirmTag.dataset.confirmationCount = report.id;
    confirmTag.textContent = confirmationLabel(report);
    confirmTag.hidden = !report.confirmation_count;
    tagWrap.appendChild(confirmTag);

    row.addEventListener("click", (event) => {
      if (event.target.closest("[data-report-issue]")) return;
      selectReport(report.id, true);
    });
    row.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      if (event.target.closest("button, a")) return;
      event.preventDefault();
      selectReport(report.id, true);
    });
    fragment.appendChild(node);
  });

  requestAnimationFrame(() => {
    list.appendChild(fragment);
    list.setAttribute("aria-busy", "false");
  });
}

function selectReport(id, panToMarker) {
  state.selectedId = id;

  document.querySelectorAll(".report-row").forEach((row) => {
    const isActive = row.dataset.reportId === id;
    row.classList.toggle("is-active", isActive);
    if (isActive) row.setAttribute("aria-current", "true");
    else row.removeAttribute("aria-current");
  });

  state.markers.forEach((marker, markerId) => {
    const active = markerId === id;
    marker.setStyle({ radius: active ? 11 : 8, weight: active ? 3 : 2 });
  });

  const marker = state.markers.get(id);
  if (marker && panToMarker) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      state.map.setView(marker.getLatLng(), Math.max(state.map.getZoom(), 8));
    } else {
      state.map.flyTo(marker.getLatLng(), Math.max(state.map.getZoom(), 8), { duration: 0.45 });
    }
  }
  if (marker) marker.openPopup();
  const selected = publishedReports().find((report) => report.id === id);
  if (selected) announce(`Выбрана отметка: ${selected.city_or_area}, ${selected.operator}`);
}

function render(options = {}) {
  const reports = getFilteredReports();
  const published = publishedReports();
  if (!reports.some((report) => report.id === state.selectedId)) state.selectedId = null;
  writeFiltersToUrl();
  renderSummary(reports);
  renderHotspots(published);
  renderOperatorPulse(published);
  renderActiveFilters();
  renderMarkers(reports);
  renderList(reports);
  if (options.fit) fitMap(reports, false);
}

async function shareCurrentView() {
  const url = window.location.href;
  const text = shareTextForCurrentView();
  try {
    if (navigator.share) {
      await navigator.share({ title: "WhiteS", text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    $("#shareButton").textContent = "Скопировано";
  } catch {
    $("#shareButton").textContent = "Ссылка в адресе";
  }

  setTimeout(() => {
    $("#shareButton").textContent = "Поделиться";
  }, 1400);
}

function shareTextForCurrentView() {
  const reports = getFilteredReports();
  const filters = filterLabels().map((item) => item.label).join(", ");
  const freshCount = reports.filter((report) => ["now", "today"].includes(freshnessFor(report))).length;
  const scope = filters ? ` по фильтру: ${filters}` : " по России";
  const freshPart = freshCount
    ? `${freshCount} ${pluralRu(freshCount, ["свежая", "свежие", "свежих"])}`
    : "без свежих отметок";
  return `WhiteS: ${reportCountLabel(reports.length)}${scope}, ${freshPart}. Проверьте регион и добавьте наблюдение без контактов.`;
}

async function main() {
  applyRuntimeCapabilities();
  readFiltersFromUrl();
  hydrateSearchFromUrlEarly();
  await loadData();
  readRuntimePreferences();
  setupMap();
  setupFilters();
  setupResponsiveView();
  render({ fit: true });
  updateConnectivityWarning();
  window.addEventListener("offline", updateConnectivityWarning);
  window.addEventListener("online", updateConnectivityWarning);

  // main() is async and awaits data before reaching this point, so the
  // window "load" event has usually already fired — register directly
  // instead of waiting for it (otherwise the listener never runs).
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

// Expose runtime state for debugging and offline E2E checks.
window.state = state;

main();
