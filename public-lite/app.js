const fallbackData = {
  updated_at: "2026-07-02T18:50:00+03:00",
  source: "Где белые списки? демо-отметки после модерации",
  disclaimer: "Пользовательские отметки, не официальные данные. Проверяйте свежесть и уровень уверенности.",
  export_manifest: {
    schema_version: "1.1",
    record_count: 4,
    generated_at: "2026-07-02T18:50:00+03:00",
    generated_from_moderation_revision: "embedded-demo-20260702-1850"
  },
  reports: [
    {
      id: "demo-001",
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
      id: "demo-002",
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
      id: "demo-003",
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
      id: "demo-004",
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
  dataUrl: "embedded fallback",
  dataSource: { mode: "fallback", url: "embedded fallback", savedAt: "", error: "" },
  map: null,
  tileLayer: null,
  markerLayer: null,
  radiusLayer: null,
  markers: new Map(),
  leafletLoadPromise: null,
  selectedId: null,
  searchDebounceId: null,
  useTiles: true,
  userContext: defaultUserContext(),
  userContextSource: "",
  savedPlaces: [],
  draftKind: "problem",
  draftSourceReportId: "",
  filters: defaultFilters()
};

const categoryMeta = {
  "internet-shutdown": { className: "shutdown", color: "#c7473f", label: "Отключение" },
  "whitelist-only": { className: "whitelist", color: "#d98621", label: "Белый список" },
  "partial-connectivity": { className: "partial", color: "#c7682d", label: "Частично" },
  restored: { className: "restored", color: "#1f7a55", label: "Восстановлено" },
  "needs-verification": { className: "unknown", color: "#7a8292", label: "Проверка" }
};

const situationStateMeta = {
  active: { className: "state-active", label: "Активно", detail: "есть актуальная проблема" },
  mixed: { className: "state-mixed", label: "Разные отметки", detail: "есть и проблема, и восстановление" },
  restoring: { className: "state-restoring", label: "Восстанавливается", detail: "есть сигнал восстановления" },
  restored: { className: "state-restored", label: "Восстановлено", detail: "свежих проблем нет" },
  stale: { className: "state-stale", label: "Устарело", detail: "нет свежих отметок" }
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
const userContextKey = "whites:user-context";
const savedPlacesKey = "whites:saved-places";
const submissionCooldownKey = "whites:last-observation-submit-at";
const submissionEndpoint = "api/observations.php";
const contextEndpoint = "api/context.php";
const submissionCooldownMs = 45000;
const leafletConfig = document.getElementById("leafletScriptConfig");
const leafletScriptUrl = leafletConfig?.dataset.src || "vendor/leaflet/leaflet.js?v=1.9.4";

const draftKindLabels = {
  problem: "Новое наблюдение",
  confirm: "Подтверждение проблемы",
  restored: "Восстановление доступа",
  complaint: "Жалоба на опубликованную отметку"
};

const draftKindIntros = {
  problem: "Если сервер приема доступен, запись уйдет в премодерацию. Черновик всегда остается ниже.",
  confirm: "Подтверждение уйдет в премодерацию и поможет объединить дубли в счетчик.",
  restored: "Отметка восстановления уйдет в премодерацию и поможет понять, что ситуация изменилась.",
  complaint: "Если в отметке есть персональные данные, точный адрес, ошибка или риск для человека, жалоба уйдет модератору."
};

const complaintReasonLabels = {
  personal_data: "Персональные данные",
  exact_location: "Точный адрес или опасная геоточка",
  dangerous: "Риск для человека",
  wrong: "Ошибка в отметке",
  duplicate: "Дубль",
  outdated: "Устарело",
  other: "Другое"
};

const searchAliases = {
  спб: "санкт-петербург питер петербург",
  питер: "санкт-петербург спб петербург",
  мегафон: "мегафон мегафон",
  телега: "telegram телеграм",
  телеграм: "telegram телега",
  вацап: "whatsapp вотсап ватсап",
  вотсап: "whatsapp вацап ватсап",
  ютуб: "youtube",
  госы: "госуслуги",
  сбп: "банки оплата"
};

const $ = (selector) => document.querySelector(selector);

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

function defaultUserContext() {
  return {
    region: "",
    operator: ""
  };
}

function normalizePlace(place) {
  return {
    region: String(place?.region || "").trim(),
    operator: String(place?.operator || "").trim()
  };
}

function placeKey(place) {
  const normalized = normalizePlace(place);
  return `${normalized.region.toLowerCase()}|${normalized.operator.toLowerCase()}`;
}

function currentPlace() {
  return normalizePlace(state.userContext);
}

function announce(message) {
  const liveRegion = $("#liveRegion");
  if (liveRegion) liveRegion.textContent = message;
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
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatSourceTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
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

function hasRestorationSignal(report) {
  return (Number(report.restoration_count) || 0) > 0 || Boolean(report.last_restored_at);
}

function reportSituationState(report) {
  const freshness = freshnessFor(report);
  if (freshness === "stale") return "stale";
  if (report.incident_category === "restored") return "restored";
  if (hasRestorationSignal(report)) return "restoring";
  return "active";
}

function situationStateForReports(reports) {
  const current = reports.filter((report) => freshnessFor(report) !== "stale");
  if (!current.length) return "stale";

  const hasActiveReports = current.some((report) => report.incident_category !== "restored");
  const hasRestoredReports = current.some((report) => report.incident_category === "restored");
  const hasRestorationSignals = current.some(hasRestorationSignal);

  if (hasActiveReports && hasRestoredReports) return "mixed";
  if (hasActiveReports && hasRestorationSignals) return "restoring";
  if (hasActiveReports) return "active";
  if (hasRestoredReports || hasRestorationSignals) return "restored";
  return "stale";
}

function situationStateForReport(report) {
  return situationStateMeta[reportSituationState(report)] || situationStateMeta.stale;
}

function normalizeText(value) {
  const base = String(value ?? "")
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aliases = base
    .split(" ")
    .map((part) => searchAliases[part] || "")
    .filter(Boolean)
    .join(" ");
  return `${base} ${aliases}`.trim();
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
      state.dataSource = { mode: "network", url: source, savedAt: new Date().toISOString(), error: "" };
      localStorage.setItem(cacheKey, JSON.stringify({ data: state.data, dataUrl: source, saved_at: state.dataSource.savedAt }));
      return;
    } catch (error) {
      state.dataSource.error = error?.message || "Не удалось загрузить публичный JSON.";
      // Try the next known public export path.
    }
  }

  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached?.data?.reports?.length) {
      state.data = cached.data;
      state.dataUrl = `${cached.dataUrl || "cache"} (кэш)`;
      state.dataSource = { mode: "cache", url: cached.dataUrl || "cache", savedAt: cached.saved_at || "", error: "" };
      return;
    }
  } catch {
    localStorage.removeItem(cacheKey);
  }

  state.data = fallbackData;
  state.dataUrl = "embedded fallback";
  state.dataSource = { mode: "fallback", url: "embedded fallback", savedAt: "", error: state.dataSource.error || "Публичный JSON и кэш недоступны." };
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

function fillContextSelect(element, values, emptyLabel) {
  element.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = emptyLabel;
  element.appendChild(empty);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    element.appendChild(option);
  });
}

function syncMySituationControls() {
  const regionSelect = $("#myRegionSelect");
  const operatorSelect = $("#myOperatorSelect");
  const hasRegion = [...regionSelect.options].some((option) => option.value === state.userContext.region);
  const hasOperator = [...operatorSelect.options].some((option) => option.value === state.userContext.operator);
  if (!hasRegion) state.userContext.region = "";
  if (!hasOperator) state.userContext.operator = "";
  regionSelect.value = state.userContext.region;
  operatorSelect.value = state.userContext.operator;
}

function refreshMySituation() {
  syncMySituationControls();
  updateContextHintText();
  renderMyPlaces();
  renderMySituation(publishedReports());
}

function setupMySituationControls(reports) {
  fillContextSelect($("#myRegionSelect"), unique(reports.map((report) => report.region)), "Выберите регион");
  fillContextSelect($("#myOperatorSelect"), unique(reports.map((report) => report.operator)), "Любой оператор");
  refreshMySituation();

  $("#myRegionSelect").addEventListener("change", (event) => {
    state.userContext.region = event.target.value;
    state.userContextSource = state.userContext.region ? "manual" : "";
    saveUserContext();
    refreshMySituation();
  });

  $("#myOperatorSelect").addEventListener("change", (event) => {
    state.userContext.operator = event.target.value;
    state.userContextSource = "manual";
    saveUserContext();
    refreshMySituation();
  });

  $("#clearMySituationButton").addEventListener("click", () => {
    state.userContext = defaultUserContext();
    state.userContextSource = "";
    saveUserContext();
    refreshMySituation();
    announce("Ваша ситуация сброшена");
  });

  $("#saveMyPlaceButton").addEventListener("click", saveCurrentPlace);
  $("#mySituationFilterButton").addEventListener("click", applyMySituationFilter);
  $("#mySituationReportButton").addEventListener("click", () => openReportDialog(reportsForUserContext()[0] || null, "problem"));
  $("#mySituationConfirmButton").addEventListener("click", () => openContextualMySituationDraft("confirm"));
  $("#mySituationRestoredButton").addEventListener("click", () => openContextualMySituationDraft("restored"));
}

function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  ["search", "category", "problem", "operator", "service", "freshness"].forEach((key) => {
    const value = params.get(key);
    if (value) state.filters[key] = value;
  });
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

function readUserContext() {
  try {
    const stored = JSON.parse(localStorage.getItem(userContextKey) || "null");
    state.userContext = {
      region: stored?.region || "",
      operator: stored?.operator || ""
    };
    state.userContextSource = state.userContext.region || state.userContext.operator ? "manual" : "";
  } catch {
    localStorage.removeItem(userContextKey);
    state.userContext = defaultUserContext();
    state.userContextSource = "";
  }

  try {
    const storedPlaces = JSON.parse(localStorage.getItem(savedPlacesKey) || "[]");
    state.savedPlaces = Array.isArray(storedPlaces)
      ? storedPlaces.map(normalizePlace).filter((place) => place.region || place.operator).slice(0, 5)
      : [];
  } catch {
    localStorage.removeItem(savedPlacesKey);
    state.savedPlaces = [];
  }
}

function saveUserContext() {
  const hasContext = state.userContext.region || state.userContext.operator;
  if (!hasContext) {
    localStorage.removeItem(userContextKey);
    return;
  }
  localStorage.setItem(userContextKey, JSON.stringify(state.userContext));
}

function saveSavedPlaces() {
  if (!state.savedPlaces.length) {
    localStorage.removeItem(savedPlacesKey);
    return;
  }
  localStorage.setItem(savedPlacesKey, JSON.stringify(state.savedPlaces.slice(0, 5)));
}

function saveCurrentPlace() {
  const place = currentPlace();
  if (!place.region && !place.operator) {
    announce("Сначала выберите регион или оператора");
    return;
  }

  const key = placeKey(place);
  state.savedPlaces = [place, ...state.savedPlaces.filter((item) => placeKey(item) !== key)].slice(0, 5);
  saveSavedPlaces();
  renderMyPlaces();
  announce("Место сохранено в этом браузере");
}

function applySavedPlace(place) {
  state.userContext = normalizePlace(place);
  state.userContextSource = "manual";
  saveUserContext();
  refreshMySituation();
  announce("Место применено");
}

async function loadContextHint() {
  if (state.userContext.region) {
    updateContextHintText();
    return;
  }

  try {
    const response = await fetch(contextEndpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("context unavailable");
    const result = await response.json();
    const hint = String(result?.region_hint || "").trim();
    const regionSelect = $("#myRegionSelect");
    const hasHint = hint && [...regionSelect.options].some((option) => option.value === hint);
    if (result?.ok && hasHint) {
      state.userContext.region = hint;
      state.userContextSource = "server_hint";
      refreshMySituation();
    }
  } catch {
    // Static hosting or unavailable PHP should keep the manual path.
  }

  updateContextHintText();
}

function updateContextHintText() {
  const hint = $("#myContextHint");
  if (!hint) return;

  if (state.userContextSource === "server_hint") {
    hint.textContent = "Регион подсказан сервером приблизительно. Его можно изменить вручную.";
    return;
  }

  hint.textContent = state.userContext.region
    ? "Регион выбран вручную и хранится только в этом браузере."
    : "Выберите регион вручную. IP не используется для публичной идентификации.";
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
  setupMySituationControls(reports);

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
  $("#copyShareTextButton").addEventListener("click", () => copySharePayload("text"));
  $("#copyShareUrlButton").addEventListener("click", () => copySharePayload("url"));
  $("#nativeShareButton").addEventListener("click", sharePreparedView);
  $("#tileModeButton").addEventListener("click", toggleTileMode);
  $("#clearLocalButton").addEventListener("click", clearLocalData);
  $("#reportButton").addEventListener("click", () => openReportDialog());
  $("#drawerReportButton").addEventListener("click", () => openReportDialog());
  $("#stickyReportButton").addEventListener("click", () => openReportDialog());
  $("#aboutDataButton").addEventListener("click", () => {
    setInfoTab("data");
    openDialog($("#aboutDialog"));
  });
  document.querySelectorAll("[data-info-tab]").forEach((button) => {
    button.addEventListener("click", () => setInfoTab(button.dataset.infoTab));
  });
  $("#copyDraftButton").addEventListener("click", copyReportDraft);
  $("#sendDraftButton").addEventListener("click", submitObservation);
  document.querySelectorAll("#reportDraftForm input, #reportDraftForm select, #reportDraftForm textarea").forEach((field) => {
    field.addEventListener("input", () => {
      updateDraftOutput();
      updateDraftRiskHint();
      clearSubmitStatus();
    });
    field.addEventListener("change", () => {
      updateDraftOutput();
      updateDraftRiskHint();
      clearSubmitStatus();
    });
  });
  $("#safetyConfirm").addEventListener("change", () => {
    updateDraftOutput();
    updateDraftRiskHint();
    clearSubmitStatus();
  });

  $("#showMapTab").addEventListener("click", () => setMobileView("map"));
  $("#showListTab").addEventListener("click", () => setMobileView("list"));
  $("#openMapFromListButton").addEventListener("click", () => setMobileView("map"));
  $("#lowBandwidthReportButton").addEventListener("click", () => openReportDialog());
  $("#lowBandwidthShareButton").addEventListener("click", shareCurrentView);
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

async function setMobileView(view) {
  document.body.classList.toggle("show-map", view === "map");
  document.body.classList.toggle("show-list", view === "list");
  $("#showMapTab").classList.toggle("is-active", view === "map");
  $("#showListTab").classList.toggle("is-active", view === "list");
  $("#showMapTab").setAttribute("aria-selected", String(view === "map"));
  $("#showListTab").setAttribute("aria-selected", String(view === "list"));
  if (view === "map") {
    const ready = await ensureMapReady();
    if (ready) setTimeout(() => state.map.invalidateSize(), 40);
  }
}

function showReportOnMap(report) {
  if (!report?.id) return;

  const reveal = () => {
    if (!report.approx_location || !state.map) {
      selectReport(report.id, false);
      announce("У этой отметки нет точки на карте");
      return;
    }

    const point = report.approx_location;
    const latLng = [point.lat, point.lon];
    const targetZoom = Math.max(state.map.getZoom(), 8);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    state.selectedId = report.id;
    document.querySelectorAll(".report-row").forEach((row) => {
      row.classList.toggle("is-active", row.dataset.reportId === report.id);
    });

    if (reducedMotion) {
      state.map.setView(latLng, targetZoom);
    } else {
      state.map.flyTo(latLng, targetZoom, { duration: 0.45 });
    }

    setTimeout(() => {
      renderMarkers(getFilteredReports());
      selectReport(report.id, false);
      announce(`Показано на карте: ${report.city_or_area}, ${report.operator}`);
    }, reducedMotion ? 80 : 520);
  };

  if (window.matchMedia("(max-width: 720px)").matches) {
    setMobileView("map").then(() => setTimeout(reveal, 80));
    return;
  }

  ensureMapReady().then(reveal);
}

function openDialog(dialog) {
  if (dialog.showModal) {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function setInfoTab(tab) {
  const selected = tab || "data";
  document.querySelectorAll("[data-info-tab]").forEach((button) => {
    const isActive = button.dataset.infoTab === selected;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll("[data-info-page]").forEach((page) => {
    const isActive = page.dataset.infoPage === selected;
    page.classList.toggle("is-active", isActive);
    page.hidden = !isActive;
  });
}

function setSelectValue(selector, value) {
  const element = $(selector);
  if ([...element.options].some((option) => option.value === value)) {
    element.value = value;
  }
}

function complaintReasonLabel(value) {
  return complaintReasonLabels[value] || value || "не указано";
}

function draftSummaryFor(kind, report) {
  if (kind === "confirm" && report) {
    return `Подтверждаю похожую ситуацию по отметке ${report.id}.`;
  }
  if (kind === "restored" && report) {
    return `По отметке ${report.id}: доступ восстановился или ситуация стала лучше.`;
  }
  if (kind === "complaint" && report) {
    return `Проверьте опубликованную отметку ${report.id}: возможно, ее нужно скрыть или отредактировать.`;
  }
  return "";
}

function openReportDialog(report = null, kind = "problem") {
  const latest = report || reportsForUserContext()[0] || getFilteredReports()[0] || null;
  state.draftKind = kind;
  state.draftSourceReportId = latest?.id || "";

  const isComplaint = kind === "complaint";
  $("#draftComplaintReasonWrap").hidden = !isComplaint;
  $("#draftComplaintReason").value = "personal_data";
  $("#reportDialogTitle").textContent = draftKindLabels[kind] || draftKindLabels.problem;
  $("#reportDialogIntro").textContent = draftKindIntros[kind] || draftKindIntros.problem;
  $("#draftWebsite").value = "";
  $("#draftArea").value = latest?.city_or_area || latest?.region || state.userContext.region || "";
  $("#draftOperator").value = latest?.operator || state.userContext.operator || "";
  $("#draftServices").value = latest?.checked_services?.join(", ") || "";
  $("#draftSummary").value = draftSummaryFor(kind, latest);
  $("#safetyConfirm").checked = false;

  if (latest?.network_type) setSelectValue("#draftNetwork", latest.network_type);
  if (kind === "restored") {
    setSelectValue("#draftProblem", "Доступ восстановился");
  } else if (latest?.problem_type) {
    setSelectValue("#draftProblem", latest.problem_type);
  }

  updateDraftOutput();
  updateDraftRiskHint();
  clearSubmitStatus();
  resetSendButton();
  openDialog($("#reportDialog"));
}

function draftValue(selector) {
  return $(selector).value.trim();
}

function updateDraftOutput() {
  const checkedAt = new Date().toLocaleString("ru-RU");
  const summary = draftValue("#draftSummary");
  const complaintReason = state.draftKind === "complaint" ? complaintReasonLabel($("#draftComplaintReason").value) : "";
  $("#draftSummaryCounter").textContent = `${summary.length} / 500`;
  const lines = [
    "Где белые списки?: черновик наблюдения",
    `Тип: ${draftKindLabels[state.draftKind] || draftKindLabels.problem}`,
    state.draftSourceReportId ? `Связано с отметкой: ${state.draftSourceReportId}` : "",
    complaintReason ? `Причина жалобы: ${complaintReason}` : "",
    `Место: ${draftValue("#draftArea") || "не указано"}`,
    `Оператор: ${draftValue("#draftOperator") || "не указано"}`,
    `Тип сети: ${$("#draftNetwork").value}`,
    `Проблема: ${$("#draftProblem").value}`,
    `Что проверяли: ${draftValue("#draftServices") || "не указано"}`,
    `Время проверки: ${checkedAt}`,
    `Уверенность: ${$("#draftConfidence").value}`,
    `Комментарий: ${summary || "нет"}`,
    "",
    "Без ФИО, телефона, email, точного адреса, GPS, аккаунтов, приватных ссылок и VPN/proxy-инструкций.",
    $("#safetyConfirm").checked ? "Safety-проверка: подтверждена." : "Safety-проверка: не подтверждена."
  ].filter((line) => line !== "");
  $("#draftOutput").value = lines.join("\n");
}

function updateDraftRiskHint() {
  const payload = buildObservationPayload();
  const scan = [
    payload.city_or_area,
    payload.operator,
    payload.network_type,
    payload.problem_type,
    payload.confidence,
    payload.summary,
    ...payload.checked_services
  ].join(" ");
  const findings = riskyContentFindings(scan);
  const hint = $("#draftRiskHint");

  if (!findings.length) {
    hint.textContent = "Комментарий выглядит безопасно для премодерации, если в нем нет личных деталей.";
    hint.className = "risk-hint is-ok";
    return;
  }

  hint.textContent = `Перед отправкой уберите или обобщите: ${findings.join(", ")}. Жалобу можно описать без повторения опасных данных.`;
  hint.className = "risk-hint is-warning";
}

async function copyReportDraft() {
  updateDraftOutput();
  try {
    await navigator.clipboard.writeText($("#draftOutput").value);
    $("#copyDraftButton").textContent = "Скопировано";
    announce("Черновик скопирован");
  } catch {
    $("#copyDraftButton").textContent = "Скопируйте вручную";
    announce("Не удалось скопировать автоматически");
  }
  setTimeout(() => {
    $("#copyDraftButton").textContent = "Скопировать безопасный черновик";
  }, 1400);
}

function resetSendButton() {
  const button = $("#sendDraftButton");
  button.disabled = false;
  button.textContent = "Отправить на модерацию";
}

function setSubmitStatus(message, type = "success") {
  const status = $("#submitStatus");
  status.textContent = message;
  status.className = `submit-status is-visible ${type === "error" ? "is-error" : "is-success"}`;
  announce(message);
}

function clearSubmitStatus() {
  const status = $("#submitStatus");
  status.textContent = "";
  status.className = "submit-status";
}

function sourceReportForDraft() {
  if (!state.draftSourceReportId) return null;
  return publishedReports().find((report) => report.id === state.draftSourceReportId) || null;
}

function splitServices(value) {
  return value
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function buildObservationPayload() {
  const source = sourceReportForDraft();
  return {
    schema_version: 1,
    kind: state.draftKind,
    source_report_id: state.draftSourceReportId || "",
    region: source?.region || state.userContext.region || "",
    city_or_area: draftValue("#draftArea"),
    operator: draftValue("#draftOperator"),
    network_type: $("#draftNetwork").value,
    problem_type: $("#draftProblem").value,
    checked_services: splitServices(draftValue("#draftServices")),
    checked_at: new Date().toISOString(),
    confidence: $("#draftConfidence").value,
    complaint_reason: state.draftKind === "complaint" ? $("#draftComplaintReason").value : "",
    summary: draftValue("#draftSummary"),
    safety_confirm: $("#safetyConfirm").checked,
    website: draftValue("#draftWebsite")
  };
}

function riskyContentFindings(value) {
  const text = String(value || "");
  const findings = [];
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) findings.push("email");
  if (/\+?\d[\d\s\-()]{7,}\d/.test(text)) findings.push("телефон");
  if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(text)) findings.push("IP");
  if (/\b\d{1,2}[.,]\d{4,}\s*[,; ]\s*\d{1,3}[.,]\d{4,}\b/.test(text)) findings.push("точные координаты");
  if (/https?:\/\/|www\.|t\.me\/|vk\.com\/|instagram\.com\/|facebook\.com\//i.test(text)) findings.push("ссылка");
  if (/\b(ул\.?|улица|проспект|пр-т|дом|д\.|квартира|кв\.|подъезд|этаж)\b/iu.test(text)) findings.push("точный адрес");
  if (/\b(vpn|proxy|прокси|wireguard|openvpn|outline|ключ|конфиг|config|wg:\/\/|ss:\/\/|vless:\/\/|trojan:\/\/)\b/iu.test(text)) findings.push("VPN/proxy или ключ");
  if (/\b(user-agent|mozilla\/5\.0|curl\/|okhttp|python-requests)\b/iu.test(text)) findings.push("служебная строка устройства");
  return unique(findings);
}

function containsPrivateData(value) {
  return riskyContentFindings(value).length > 0;
}

function validateObservationPayload(payload) {
  if (!payload.safety_confirm) {
    return "Подтвердите safety-проверку: без личных данных, точного адреса, GPS, приватных ссылок и опасных инструкций.";
  }
  if (!payload.city_or_area) return "Укажите город или район без точного адреса.";
  if (!payload.operator) return "Укажите оператора или напишите \"не знаю\".";
  if (payload.kind === "complaint" && !payload.source_report_id) return "Жалоба должна быть связана с опубликованной отметкой.";
  if (payload.kind === "complaint" && !payload.complaint_reason) return "Выберите причину жалобы.";
  if (payload.summary.length > 500) return "Комментарий слишком длинный.";

  const privateScan = [
    payload.region,
    payload.city_or_area,
    payload.operator,
    payload.network_type,
    payload.problem_type,
    payload.confidence,
    payload.summary,
    ...payload.checked_services
  ].join(" ");
  const findings = riskyContentFindings(privateScan);
  if (findings.length) {
    return `Перед отправкой уберите: ${findings.join(", ")}. Если это жалоба на опасную отметку, опишите риск без повторения личных данных.`;
  }
  return "";
}

function fallbackSubmissionMessage() {
  return "Сервер приема сейчас недоступен. Черновик сохранен ниже: его можно скопировать и отправить модератору вручную.";
}

async function submitObservation() {
  updateDraftOutput();
  const payload = buildObservationPayload();
  const validationError = validateObservationPayload(payload);
  if (validationError) {
    setSubmitStatus(validationError, "error");
    return;
  }

  const lastSubmitAt = Number(localStorage.getItem(submissionCooldownKey) || 0);
  const waitMs = submissionCooldownMs - (Date.now() - lastSubmitAt);
  if (waitMs > 0) {
    setSubmitStatus(`Подождите ${Math.ceil(waitMs / 1000)} сек. перед повторной отправкой.`, "error");
    return;
  }

  const button = $("#sendDraftButton");
  button.disabled = true;
  button.textContent = "Отправка...";

  try {
    const response = await fetch(submissionEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      throw new Error(result?.message || fallbackSubmissionMessage());
    }

    localStorage.setItem(submissionCooldownKey, String(Date.now()));
    button.textContent = "Принято";
    setSubmitStatus(result.message || "Наблюдение принято на модерацию.", "success");
  } catch (error) {
    button.textContent = "Не отправлено";
    setSubmitStatus(error?.message || fallbackSubmissionMessage(), "error");
  } finally {
    setTimeout(resetSendButton, 1600);
  }
}

function updateTileModeButton() {
  $("#tileModeButton").textContent = state.useTiles ? "Тайлы вкл" : "Тайлы выкл";
  $("#tileModeButton").setAttribute("aria-pressed", String(state.useTiles));
}

function toggleTileMode() {
  state.useTiles = !state.useTiles;
  localStorage.setItem(noTilesKey, state.useTiles ? "0" : "1");
  updateTileModeButton();

  if (!state.map) return;
  if (state.useTiles) {
    addTileLayer();
    $("#tileWarning").hidden = true;
  } else {
    if (state.tileLayer) {
      state.map.removeLayer(state.tileLayer);
      state.tileLayer = null;
    }
    $("#tileWarning").hidden = false;
  }
  renderLowBandwidthPanel();
}

function clearLocalData() {
  localStorage.removeItem(cacheKey);
  localStorage.removeItem(noTilesKey);
  localStorage.removeItem(userContextKey);
  localStorage.removeItem(savedPlacesKey);
  localStorage.removeItem(submissionCooldownKey);
  state.userContext = defaultUserContext();
  state.userContextSource = "";
  state.savedPlaces = [];
  refreshMySituation();
  $("#clearLocalButton").textContent = "Очищено";
  announce("Локальный кэш очищен");
  setTimeout(() => {
    $("#clearLocalButton").textContent = "Очистить";
  }, 1400);
}

function loadLeafletScript() {
  if (window.L) return Promise.resolve(true);
  if (state.leafletLoadPromise) return state.leafletLoadPromise;

  state.leafletLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = leafletScriptUrl;
    script.async = true;
    script.onload = () => resolve(Boolean(window.L));
    script.onerror = () => reject(new Error("Leaflet script failed to load"));
    document.body.appendChild(script);
  }).catch(() => {
    state.leafletLoadPromise = null;
    $("#tileWarning").hidden = false;
    renderLowBandwidthPanel();
    return false;
  });

  return state.leafletLoadPromise;
}

async function ensureMapReady(options = {}) {
  if (state.map) return true;

  const loaded = await loadLeafletScript();
  if (!loaded || !window.L) {
    $("#tileWarning").hidden = false;
    renderLowBandwidthPanel();
    return false;
  }

  setupMap();
  renderMarkers(getFilteredReports());
  fitMap(getFilteredReports(), Boolean(options.forceFit));
  return Boolean(state.map);
}

function setupMap() {
  if (state.map) return;
  if (!window.L) {
    $("#tileWarning").hidden = false;
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
    .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>')
    .addTo(state.map);

  if (state.useTiles) {
    addTileLayer();
  } else {
    $("#tileWarning").hidden = false;
  }
  renderLowBandwidthPanel();

  state.radiusLayer = L.layerGroup().addTo(state.map);
  state.markerLayer = L.layerGroup().addTo(state.map);
  state.map.on("zoomend", () => renderMarkers(getFilteredReports()));
}

function addTileLayer() {
  if (!state.map || state.tileLayer) return;

  const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 3,
    maxZoom: 18
  });

  let tileErrorShown = false;
  tiles.on("tileerror", () => {
    if (tileErrorShown) return;
    tileErrorShown = true;
    $("#tileWarning").hidden = false;
    renderLowBandwidthPanel();
  });

  tiles.addTo(state.map);
  state.tileLayer = tiles;
}

function getFilteredReports() {
  const search = normalizeText(state.filters.search);
  return publishedReports().filter((report) => {
    if (state.filters.category !== "all" && report.incident_category !== state.filters.category) return false;
    if (state.filters.problem !== "all" && report.problem_type !== state.filters.problem) return false;
    if (state.filters.operator !== "all" && report.operator !== state.filters.operator) return false;
    if (state.filters.service !== "all" && !(report.checked_services || []).includes(state.filters.service)) return false;
    if (state.filters.freshness !== "all" && freshnessFor(report) !== state.filters.freshness) return false;
    if (!search) return true;

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
    ]
      .join(" ")
      ;
    return normalizeText(haystack).includes(search);
  });
}

function popupHtml(report) {
  const category = categoryFor(report);
  const stateMeta = situationStateForReport(report);
  const confirmationText = report.confirmation_count ? `${report.confirmation_count} подтвержд.` : "";
  const restorationText = report.restoration_count ? `${report.restoration_count} восстановл.` : "";
  const precisionText = report.approx_location?.precision ? `точность: ${report.approx_location.precision}` : "";
  const tags = [
    { value: stateMeta.label, className: `strong ${stateMeta.className}` },
    { value: category.label },
    { value: freshnessLabels[freshnessFor(report)] },
    { value: report.confidence },
    { value: confirmationText },
    { value: restorationText },
    { value: precisionText },
    ...(report.checked_services || []).slice(0, 4).map((value) => ({ value }))
  ]
    .filter((tag) => tag.value)
    .map((tag) => `<span class="tag ${tag.className || ""}">${escapeHtml(tag.value)}</span>`)
    .join("");

  return `
    <h2 class="popup-title">${escapeHtml(report.city_or_area)}, ${escapeHtml(report.operator)}</h2>
    <p class="popup-meta">${escapeHtml(report.region)} · ${escapeHtml(report.network_type)} · ${escapeHtml(formatTime(report.checked_at))}</p>
    <p class="popup-text">${escapeHtml(report.summary)}</p>
    <div class="popup-tags">${tags}</div>
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
        state.map.flyTo(marker.getLatLng(), Math.max(state.map.getZoom() + 2, 6), { duration: 0.45 });
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
        opacity: 1
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
  const incidents = incidentGroups(reports);
  const activeIncidents = incidents.filter((incident) => ["active", "mixed", "restoring"].includes(incident.state)).length;
  const restored = restorationCount(reports);
  const fresh = reports.filter((report) => ["now", "today"].includes(freshnessFor(report))).length;
  const topIncident = incidents[0] || null;

  $("#activeIncidentCount").textContent = activeIncidents;
  $("#totalCount").textContent = reports.length;
  $("#freshCount").textContent = fresh;
  $("#restoredCount").textContent = restored;
  $("#updatedAt").textContent = `обновлено ${formatTime(state.data.updated_at)}`;
  $("#summaryHeadline").textContent = activeIncidents
    ? `Сейчас заметно: ${activeIncidents} ${pluralRu(activeIncidents, ["инцидент", "инцидента", "инцидентов"])}`
    : "Сейчас нет свежих активных инцидентов";
  $("#summaryLede").textContent = topIncident
    ? `${topIncident.city_or_area}, ${topIncident.operator}: ${topIncident.stateMeta.detail}. Последняя проверка ${formatTime(topIncident.latest.checked_at)}.`
    : "Нет свежих опубликованных проблем. Это не значит, что проблемы нет: новых отметок могло еще не быть.";

  const isDemo = state.data.source?.toLocaleLowerCase("ru").includes("demo") || state.dataUrl.includes("sample");
  const badge = $("#dataBadge");
  badge.classList.remove("is-live", "is-demo", "is-cache", "is-fallback");
  const statePanel = $("#dataStatePanel");
  const actions = $("#dataStateActions");
  actions.innerHTML = "";
  statePanel.classList.remove("is-cache", "is-fallback", "is-live", "is-demo");

  const addStateAction = (label, handler, className = "ghost-button") => {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", handler);
    actions.appendChild(button);
  };

  if (state.dataSource.mode === "cache") {
    const savedAt = formatSourceTime(state.dataSource.savedAt);
    badge.textContent = "данные из кэша";
    badge.classList.add("is-cache");
    statePanel.classList.add("is-cache");
    badge.title = savedAt ? `Последняя сохраненная копия: ${savedAt}` : "Показана последняя сохраненная копия";
    badge.setAttribute("aria-label", badge.title);
    $("#dataStateTitle").textContent = "Показываем последнюю сохраненную копию";
    $("#sourceNote").textContent = `Показана последняя сохраненная копия${savedAt ? ` от ${savedAt}` : ""}. Источник: ${state.data.source || state.dataSource.url}. Публично показываются только опубликованные модерацией записи.`;
    addStateAction("Обновить", () => window.location.reload());
    addStateAction("Очистить кэш", clearLocalData);
    return;
  }

  if (state.dataSource.mode === "fallback") {
    badge.textContent = "резервные данные";
    badge.classList.add("is-fallback");
    statePanel.classList.add("is-fallback");
    badge.title = "Не удалось загрузить публичный JSON, показан встроенный резервный набор.";
    badge.setAttribute("aria-label", badge.title);
    $("#dataStateTitle").textContent = "Показан резервный набор";
    $("#sourceNote").textContent = "Показан встроенный резервный набор, потому что публичный JSON и кэш недоступны. Публично показываются только безопасные демонстрационные записи.";
    addStateAction("Попробовать снова", () => window.location.reload());
    addStateAction("Сообщить наблюдение", () => openReportDialog(), "primary-button");
    return;
  }

  badge.textContent = isDemo ? "демо-данные" : "живые данные";
  badge.classList.add(isDemo ? "is-demo" : "is-live");
  statePanel.classList.add(isDemo ? "is-demo" : "is-live");
  badge.title = isDemo ? "Показаны демонстрационные модерированные записи." : "Показана свежая загрузка публичного JSON.";
  badge.setAttribute("aria-label", badge.title);
  $("#dataStateTitle").textContent = isDemo ? "Демо-данные после модерации" : "Свежая загрузка публичного JSON";
  $("#sourceNote").textContent = `Источник: ${state.data.source || state.dataUrl}. Публично показываются только опубликованные модерацией записи.`;
  if (isDemo) addStateAction("О данных", () => {
    setInfoTab("data");
    openDialog($("#aboutDialog"));
  });
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

function renderMyPlaces() {
  const container = $("#myPlacesList");
  if (!container) return;

  container.innerHTML = "";
  const activeKey = placeKey(currentPlace());
  state.savedPlaces.forEach((place) => {
    const label = [place.region || "Все регионы", place.operator || "любой оператор"].join(" · ");
    const button = document.createElement("button");
    button.className = "my-place-chip";
    button.type = "button";
    button.textContent = label;
    button.classList.toggle("is-active", placeKey(place) === activeKey);
    button.setAttribute("aria-label", `Показать сохраненное место: ${label}`);
    button.addEventListener("click", () => applySavedPlace(place));
    container.appendChild(button);
  });
}

function reportsForUserContext() {
  const { region, operator } = state.userContext;
  if (!region && !operator) return [];

  return publishedReports().filter((report) => {
    if (region && report.region !== region) return false;
    if (operator && report.operator !== operator) return false;
    return true;
  });
}

function restorationCount(reports) {
  return reports.reduce((sum, report) => {
    const explicitCount = Number(report.restoration_count) || 0;
    return sum + explicitCount + (report.incident_category === "restored" && !explicitCount ? 1 : 0);
  }, 0);
}

function confirmationCount(reports) {
  return reports.reduce((sum, report) => sum + (Number(report.confirmation_count) || 0), 0);
}

function situationSummary(reports) {
  const state = situationStateForReports(reports);
  const meta = situationStateMeta[state] || situationStateMeta.stale;
  const active = reports.filter((report) => report.incident_category !== "restored" && freshnessFor(report) !== "stale");
  const category = active.length ? worstCategory(active) : (state === "restored" ? "restored" : "needs-verification");
  const categoryLabel = categoryMeta[category]?.label || "Проверка";
  const detail = state === "active" ? categoryLabel.toLocaleLowerCase("ru") : meta.detail;

  return { state, meta, category, detail };
}

function applyMySituationFilter() {
  const { region, operator } = state.userContext;
  if (!region && !operator) {
    announce("Сначала выберите регион или оператора");
    return;
  }

  state.filters.search = region || "";
  state.filters.operator = operator || "all";
  syncFilterControls();
  render({ fit: true });
  announce("Показаны отметки по вашей ситуации");
}

function latestMySituationReport() {
  return reportsForUserContext()[0] || null;
}

function openContextualMySituationDraft(kind) {
  const latest = latestMySituationReport();
  openReportDialog(latest, latest ? kind : "problem");
  if (!latest) {
    announce("Нет опубликованной отметки для подтверждения. Можно отправить новое наблюдение.");
  }
}

function renderMySituation() {
  const container = $("#mySituationCard");
  const { region, operator } = state.userContext;

  if (!region && !operator) {
    container.innerHTML = `
      <p class="situation-empty">Выберите регион и оператора: сводка останется только в этом браузере.</p>
      <p class="situation-footnote">Без аккаунта, телефона, email и точной геолокации.</p>
    `;
    return;
  }

  const reports = reportsForUserContext();
  const title = [region || "Все регионы", operator || "любой оператор"].join(" · ");

  if (!reports.length) {
    container.innerHTML = `
      <div class="situation-status">
        <span class="situation-title">${escapeHtml(title)}</span>
        <span class="status-badge state-stale">Нет данных</span>
      </div>
      <p class="situation-empty">Нет опубликованных отметок. Это не значит, что проблемы нет: новых данных могло еще не быть.</p>
      <p class="situation-footnote">Можно сообщить наблюдение, оно появится публично только после модерации.</p>
    `;
    return;
  }

  const summary = situationSummary(reports);
  const fresh = reports.filter((report) => ["now", "today"].includes(freshnessFor(report))).length;
  const last = sortedReports(reports)[0];
  const stateLine = `${summary.meta.label}: ${summary.detail}`;
  container.innerHTML = `
    <div class="situation-status">
      <span class="situation-title">${escapeHtml(title)}</span>
      <span class="status-badge ${summary.meta.className}">${escapeHtml(summary.meta.label)}</span>
    </div>
    <p class="situation-answer">${escapeHtml(stateLine)}</p>
    <div class="situation-metrics" aria-label="Сводка по выбранной ситуации">
      <span><strong>${fresh}</strong> свежих</span>
      <span><strong>${confirmationCount(reports)}</strong> подтвержд.</span>
      <span><strong>${restorationCount(reports)}</strong> восстановл.</span>
    </div>
    <p class="situation-footnote">Последняя проверка: ${escapeHtml(formatTime(last.checked_at))}. Точки примерные, авторы не публикуются.</p>
  `;
}

function incidentKeyFor(report) {
  return [report.region, report.city_or_area, report.operator, report.network_type]
    .map((value) => normalizeText(value) || "unknown")
    .join("|");
}

function incidentCategoryFor(reports) {
  const active = reports.filter((report) => report.incident_category !== "restored" && freshnessFor(report) !== "stale");
  return active.length ? worstCategory(active) : worstCategory(reports);
}

function incidentGroups(reports) {
  const groups = new Map();

  reports.forEach((report) => {
    const key = incidentKeyFor(report);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        region: report.region || "Регион не указан",
        city_or_area: report.city_or_area || "Место не указано",
        operator: report.operator || "Оператор не указан",
        network_type: report.network_type || "Сеть не указана",
        reports: [],
        problemTypes: new Set(),
        services: new Set()
      });
    }

    const group = groups.get(key);
    group.reports.push(report);
    if (report.problem_type) group.problemTypes.add(report.problem_type);
    (report.checked_services || []).forEach((service) => group.services.add(service));
  });

  return [...groups.values()].map((group) => {
    const reportsSorted = sortedReports(group.reports);
    const latest = reportsSorted[0];
    const state = situationStateForReports(group.reports);
    const stateMeta = situationStateMeta[state] || situationStateMeta.stale;
    const categoryKey = incidentCategoryFor(group.reports);
    const category = categoryMeta[categoryKey] || categoryMeta["needs-verification"];
    const fresh = group.reports.filter((report) => ["now", "today"].includes(freshnessFor(report))).length;
    const latestTime = new Date(latest?.checked_at || 0).getTime() || 0;
    const stateWeight = { active: 4, mixed: 4, restoring: 3, restored: 2, stale: 1 }[state] || 0;
    const score = stateWeight * 20 + (categoryWeight[categoryKey] || 0) * 4 + fresh * 3 + group.reports.length;

    return {
      ...group,
      reports: reportsSorted,
      latest,
      latestTime,
      state,
      stateMeta,
      category,
      fresh,
      score,
      confirmationTotal: confirmationCount(group.reports),
      restorationTotal: restorationCount(group.reports),
      problemLabels: unique([...group.problemTypes]),
      serviceLabels: unique([...group.services])
    };
  }).sort((a, b) => b.score - a.score || b.latestTime - a.latestTime || a.city_or_area.localeCompare(b.city_or_area, "ru"));
}

function applyIncidentFilter(incident) {
  state.filters.search = incident.city_or_area || incident.region;
  state.filters.operator = incident.operator || "all";
  state.filters.problem = incident.problemLabels.length === 1 ? incident.problemLabels[0] : "all";
  state.selectedId = incident.latest?.id || null;
  syncFilterControls();
  render({ fit: true });
  if (state.selectedId) selectReport(state.selectedId, false);
  announce(`Показан инцидент: ${incident.city_or_area}, ${incident.operator}`);
}

function renderIncidents(reports) {
  const container = $("#incidentRollups");
  container.innerHTML = "";

  const incidents = incidentGroups(reports).slice(0, 5);
  if (!incidents.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "По текущим фильтрам нет сгруппированных инцидентов.";
    container.appendChild(empty);
    return;
  }

  incidents.forEach((incident) => {
    const button = document.createElement("button");
    button.className = "incident-card";
    button.type = "button";
    button.classList.toggle("is-active", state.selectedId && incident.reports.some((report) => report.id === state.selectedId));
    button.setAttribute("aria-label", `Показать инцидент ${incident.city_or_area}, ${incident.operator}`);

    const main = document.createElement("span");
    main.className = "incident-main";

    const title = document.createElement("strong");
    title.textContent = `${incident.city_or_area}, ${incident.operator}`;
    const meta = document.createElement("span");
    meta.textContent = `${incident.region} · ${incident.network_type} · ${reportCountLabel(incident.reports.length)}`;
    const problems = document.createElement("span");
    problems.className = "incident-problems";
    problems.textContent = incident.problemLabels.slice(0, 2).join(" · ") || incident.category.label;
    main.append(title, meta, problems);

    const side = document.createElement("span");
    side.className = "incident-side";
    const badge = document.createElement("span");
    badge.className = `status-badge ${incident.stateMeta.className}`;
    badge.textContent = incident.stateMeta.label;
    const time = document.createElement("small");
    time.textContent = formatTime(incident.latest.checked_at);
    side.append(badge, time);

    const metrics = document.createElement("span");
    metrics.className = "incident-metrics";
    metrics.textContent = `${freshCountLabel(incident.fresh)} · ${incident.confirmationTotal} подтвержд. · ${incident.restorationTotal} восстановл.`;

    button.append(main, side, metrics);
    button.addEventListener("click", () => applyIncidentFilter(incident));
    container.appendChild(button);
  });
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
  const reportButton = $("#stickyReportButton");
  const labels = filterLabels();
  container.querySelectorAll(".filter-chip, .filter-reset-chip").forEach((chip) => chip.remove());
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
    container.insertBefore(chip, reportButton);
  });

  if (labels.length > 1) {
    const reset = document.createElement("button");
    reset.className = "filter-chip filter-reset-chip";
    reset.type = "button";
    reset.textContent = "сбросить все";
    reset.setAttribute("aria-label", "Сбросить все активные фильтры");
    reset.addEventListener("click", resetAllFilters);
    container.insertBefore(reset, reportButton);
  }
}

function renderList(reports) {
  const list = $("#reportsList");
  const template = $("#reportTemplate");
  list.innerHTML = "";
  renderLowBandwidthPanel();

  if (!reports.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = publishedReports().length ? "По фильтрам ничего не найдено" : "Пока нет опубликованных отметок";
    const text = document.createElement("p");
    text.textContent = publishedReports().length
      ? "Сбросьте фильтры или отправьте новое наблюдение. Отсутствие совпадений не подтверждает, что проблемы нет."
      : "Публичный список пуст. Это не значит, что проблемы нет: отметки могли еще не пройти модерацию.";
    const reset = document.createElement("button");
    reset.className = "ghost-button";
    reset.type = "button";
    reset.textContent = "Сбросить фильтры";
    reset.hidden = !publishedReports().length;
    reset.addEventListener("click", () => $("#resetFiltersButton").click());
    const report = document.createElement("button");
    report.className = "primary-button";
    report.type = "button";
    report.textContent = "Сообщить наблюдение";
    report.addEventListener("click", () => openReportDialog());

    const about = document.createElement("button");
    about.className = "ghost-button";
    about.type = "button";
    about.textContent = "Как читать данные";
    about.addEventListener("click", () => {
      setInfoTab("data");
      openDialog($("#aboutDialog"));
    });

    const actions = document.createElement("div");
    actions.className = "empty-actions";
    actions.append(report, about);
    if (publishedReports().length) actions.prepend(reset);

    empty.append(title, text, actions);
    list.appendChild(empty);
    return;
  }

  reports.forEach((report) => {
    const node = template.content.cloneNode(true);
    const row = node.querySelector(".report-row");
    const category = categoryFor(report);
    const stateMeta = situationStateForReport(report);
    const confirmationText = report.confirmation_count ? `${report.confirmation_count} подтвержд.` : "";
    const restorationText = report.restoration_count ? `${report.restoration_count} восстановл.` : "";
    const tags = [category.label, freshnessLabels[freshnessFor(report)], report.confidence, confirmationText, restorationText, ...(report.checked_services || []).slice(0, 3)].filter(Boolean);

    row.dataset.reportId = report.id;
    row.classList.toggle("is-active", report.id === state.selectedId);
    row.querySelector(".row-status").classList.add(category.className);
    row.querySelector(".row-status").setAttribute("aria-label", category.label);
    row.querySelector(".row-title").textContent = `${report.city_or_area}, ${report.operator}`;
    row.querySelector(".row-status-label").classList.add(stateMeta.className);
    row.querySelector(".row-status-label").textContent = stateMeta.label;
    row.querySelector(".row-meta").textContent = `${report.region} · ${report.network_type} · ${formatTime(report.checked_at)} · ${freshnessLabels[freshnessFor(report)]}`;
    row.querySelector(".row-summary").textContent = report.summary;

    const tagWrap = row.querySelector(".row-tags");
    tags.forEach((value) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      if (String(value).includes("подтвержд")) tag.classList.add("strong");
      if (String(value).includes("восстановл")) tag.classList.add("strong", "state-restored");
      tag.textContent = value;
      tagWrap.appendChild(tag);
    });

    row.addEventListener("click", () => selectReport(report.id, true));
    node.querySelectorAll(".report-action").forEach((button) => {
      const action = button.dataset.action || "problem";
      if (action === "map") {
        button.hidden = !report.approx_location;
        button.setAttribute("aria-label", `Показать на карте ${report.city_or_area}, ${report.operator}`);
      }

      button.addEventListener("click", () => {
        if (action === "map") {
          showReportOnMap(report);
          return;
        }
        openReportDialog(report, action);
      });
    });
    list.appendChild(node);
  });
}

function renderLowBandwidthPanel() {
  const panel = $("#lowBandwidthPanel");
  if (!panel) return;
  panel.classList.toggle("is-no-tiles", !state.useTiles || !state.tileLayer);
}

function selectReport(id, panToMarker) {
  state.selectedId = id;

  document.querySelectorAll(".report-row").forEach((row) => {
    row.classList.toggle("is-active", row.dataset.reportId === id);
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
}

function render(options = {}) {
  const reports = getFilteredReports();
  const published = publishedReports();
  if (!reports.some((report) => report.id === state.selectedId)) state.selectedId = null;
  writeFiltersToUrl();
  renderSummary(reports);
  renderMyPlaces();
  renderMySituation();
  renderIncidents(reports);
  renderHotspots(published);
  renderOperatorPulse(published);
  renderActiveFilters();
  renderMarkers(reports);
  renderList(reports);
  if (options.fit) fitMap(reports, false);
}

function currentSharePayload() {
  const labels = filterLabels().map((item) => item.label);
  const context = labels.length ? `выбранные фильтры: ${labels.join(", ")}` : "общая публичная карта";
  const url = window.location.href;
  const text = [
    `Где белые списки?: ${context}.`,
    "Публичные модерированные отметки без точных адресов, телефонов и личных данных.",
    url
  ].join(" ");

  return { context, text, url };
}

function updateShareDialog() {
  const payload = currentSharePayload();
  $("#shareText").value = payload.text;
  $("#shareUrl").value = payload.url;
}

function shareCurrentView() {
  updateShareDialog();
  openDialog($("#shareDialog"));
}

async function copySharePayload(kind) {
  const payload = currentSharePayload();
  const button = kind === "url" ? $("#copyShareUrlButton") : $("#copyShareTextButton");
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(kind === "url" ? payload.url : payload.text);
    button.textContent = "Скопировано";
    announce(kind === "url" ? "Ссылка скопирована" : "Текст скопирован");
  } catch {
    button.textContent = "Не скопировано";
    announce("Не удалось скопировать автоматически");
  }

  setTimeout(() => {
    button.textContent = original;
  }, 1400);
}

async function sharePreparedView() {
  const payload = currentSharePayload();
  try {
    if (navigator.share) {
      await navigator.share({ title: "Где белые списки?", text: payload.text, url: payload.url });
      return;
    }
    await navigator.clipboard.writeText(payload.text);
    $("#nativeShareButton").textContent = "Скопировано";
  } catch {
    $("#nativeShareButton").textContent = "Ссылка в поле";
  }

  setTimeout(() => {
    $("#nativeShareButton").textContent = "Поделиться";
  }, 1400);
}

function registerOfflineShell() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Offline shell is optional; the public list must keep working without it.
  });
}

async function main() {
  await loadData();
  readFiltersFromUrl();
  readRuntimePreferences();
  readUserContext();
  setupFilters();
  await loadContextHint();
  const isMobile = window.matchMedia("(max-width: 720px)").matches;
  if (!isMobile) await ensureMapReady({ forceFit: true });
  await setMobileView(isMobile ? "list" : "map");
  render({ fit: !isMobile });
  registerOfflineShell();
}

main();
