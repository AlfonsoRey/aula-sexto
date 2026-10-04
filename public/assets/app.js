import { LEVELS, validateCatalog, validateTopic } from "./content-validation.js";
import { matches } from "./practice.js";

const byId = (id) => document.getElementById(id);
const controls = { search: byId("search"), topic: byId("topic"), difficulty: byId("difficulty") };
const state = { catalog: null, exercises: [], course: null, subject: "", openTopics: new Set() };
const number = new Intl.NumberFormat("es-ES");

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function chart(data, visual) {
  const container = element("div");
  const table = element("table");
  table.append(element("caption", "", data.caption));
  const head = element("thead");
  const row = element("tr");
  for (const label of [data.categoryLabel, data.valueLabel]) {
    const th = element("th", "", label);
    th.scope = "col";
    row.append(th);
  }
  head.append(row);
  const body = element("tbody");
  for (const item of data.values) {
    const tr = element("tr");
    const th = element("th", "", item.label);
    th.scope = "row";
    tr.append(th, element("td", "", number.format(item.value)));
    body.append(tr);
  }
  table.append(head, body);
  container.append(table);
  if (visual) {
    const bars = element("div", "chart-bars");
    bars.setAttribute("aria-hidden", "true");
    const maximum = Math.max(1, ...data.values.map((item) => item.value));
    for (const item of data.values) {
      const chartRow = element("div", "chart-row");
      const track = element("span");
      const bar = element("span", "chart-bar");
      bar.style.width = `${item.value / maximum * 100}%`;
      track.append(bar);
      chartRow.append(element("span", "", item.label), track, element("span", "", number.format(item.value)));
      bars.append(chartRow);
    }
    container.append(bars);
  }
  return container;
}

function disclosure(exercise, kind) {
  const isHint = kind === "hints";
  const label = isHint ? "pista" : "solución";
  const button = element("button", isHint ? "secondary" : "", `Ver ${label}`);
  button.type = "button";
  const content = element("div", "revealed");
  content.id = `${exercise.id}-${kind}`;
  content.hidden = true;
  button.setAttribute("aria-controls", content.id);
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", `Ver ${label}: ${exercise.title}`);
  let hintIndex = 0;
  if (isHint) {
    content.append(element("h5", "", "Pistas para avanzar"));
    content.append(element("ol"));
  } else {
    content.append(element("h5", "", "Solución paso a paso"), element("p", "", exercise.solution));
    const steps = element("ol");
    exercise.steps.forEach((step) => steps.append(element("li", "", step)));
    content.append(steps);
  }
  button.addEventListener("click", () => {
    content.hidden = !content.hidden;
    const expanded = !content.hidden;
    button.setAttribute("aria-expanded", String(expanded));
    button.textContent = `${expanded ? "Ocultar" : "Ver"} ${label}`;
    button.setAttribute("aria-label", `${expanded ? "Ocultar" : "Ver"} ${label}: ${exercise.title}`);
    if (isHint && expanded && hintIndex === 0) {
      content.querySelector("ol").append(element("li", "", exercise.hints[hintIndex++]));
    }
  });
  if (isHint && exercise.hints.length > 1) {
    const next = element("button", "secondary", "Otra pista");
    next.type = "button";
    next.addEventListener("click", () => {
      content.querySelector("ol").append(element("li", "", exercise.hints[hintIndex++]));
      if (hintIndex === exercise.hints.length) {
        next.disabled = true;
        next.textContent = "Ya tienes todas las pistas";
      }
    });
    content.append(next);
  }
  return { button, content };
}

function card(exercise) {
  const article = element("article", "exercise");
  article.dataset.exercise = exercise.id;
  const heading = element("div", "exercise-header");
  const title = element("h4", "", exercise.title);
  title.id = `${exercise.id}-title`;
  article.setAttribute("aria-labelledby", title.id);
  heading.append(title, element("span", "level", LEVELS[exercise.difficulty]));
  article.append(heading, element("p", "", exercise.statement));
  if (exercise.chart) article.append(chart(exercise.chart, true));
  const actions = element("div", "exercise-actions");
  const hint = disclosure(exercise, "hints");
  const solution = disclosure(exercise, "solution");
  actions.append(hint.button, solution.button);
  article.append(actions, hint.content, solution.content);
  return article;
}

function preparePrint(selected) {
  const root = byId("print-view");
  root.replaceChildren(element("h1", "", `Aula sexto · ${state.course.title} · Hoja de ejercicios`));
  root.append(element("p", "", "Nombre (opcional, solo en papel): ____________________    Fecha: ____________"));
  root.append(element("p", "", `${selected.length} ejercicios · Sin pistas ni soluciones · Proyecto educativo independiente, no oficial del CEIPSO Príncipe Felipe.`));
  let index = 0;
  for (const subject of courseSubjects()) {
    for (const topic of subject.topics) {
      const exercises = selected.filter((exercise) => exercise.topic === topic.id);
      if (!exercises.length) continue;
      root.append(element("h2", "", `${subject.title} · ${topic.title}`));
      for (const exercise of exercises) {
        const article = element("article", "print-exercise");
        article.append(element("h3", "", `${++index}. ${exercise.title} (${LEVELS[exercise.difficulty]})`), element("p", "", exercise.statement));
        if (exercise.chart) article.append(chart(exercise.chart, false));
        const space = element("div", "answer-space");
        space.setAttribute("aria-hidden", "true");
        article.append(space);
        root.append(article);
      }
    }
  }
}

function render() {
  if (!state.catalog || !state.course) return;
  const filters = { subject: state.subject, ...Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, input.value])) };
  const selected = state.exercises.filter((exercise) => matches(exercise, filters));
  const root = byId("results");
  root.replaceChildren();
  byId("result-count").textContent = `${selected.length} ${selected.length === 1 ? "ejercicio disponible" : "ejercicios disponibles"}. Las pistas y soluciones están cerradas.`;
  byId("print").disabled = selected.length === 0;
  const filtering = Boolean(filters.search || filters.topic || filters.difficulty);
  for (const subject of courseSubjects()) {
    for (const topic of subject.topics) {
      const exercises = selected.filter((exercise) => exercise.topic === topic.id);
      if (!exercises.length) continue;
      const details = element("details", "topic");
      details.dataset.topic = topic.id;
      details.open = filtering || state.openTopics.has(topic.id);
      details.addEventListener("toggle", () => {
        if (!details.isConnected) return;
        if (details.open) state.openTopics.add(topic.id);
        else state.openTopics.delete(topic.id);
      });
      const summary = element("summary");
      summary.append(element("h3", "", topic.title), element("span", "topic-count", `${exercises.length} ejercicios`));
      const list = element("div", "exercise-list");
      exercises.forEach((exercise) => list.append(card(exercise)));
      details.append(summary, element("p", "topic-description", topic.description), list);
      root.append(details);
    }
  }
  if (!selected.length) root.append(element("p", "notice", "No hay ejercicios con estos filtros. Prueba otra palabra o limpia los filtros."));
  preparePrint(selected);
}

function selectSubject(id) {
  state.subject = id;
  controls.topic.replaceChildren(new Option("Todos los temas", ""));
  const subject = courseSubjects().find((item) => item.id === id);
  subject.topics.forEach((topic) => controls.topic.append(new Option(topic.title, topic.id)));
  for (const button of byId("subjects").querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.subject === id));
  }
  render();
}

function courseSubjects() {
  return state.catalog.subjects.filter((subject) => state.course.subjects.includes(subject.id));
}

function route(focus = false) {
  if (!state.catalog) return;
  const match = /^#\/curso\/([a-z][a-z0-9-]*)$/.exec(location.hash);
  const course = match && state.catalog.courses.find((item) => item.id === match[1]);
  const unknown = location.hash.startsWith("#/") && location.hash !== "#/" && !course;
  byId("home-screen").hidden = Boolean(course);
  byId("course-screen").hidden = !course;
  state.course = course || null;
  state.subject = "";
  state.openTopics.clear();
  Object.values(controls).forEach((control) => { control.value = ""; });
  byId("results").replaceChildren();
  byId("print-view").replaceChildren();
  byId("print").disabled = true;
  byId("load-error").hidden = !unknown;
  if (unknown) byId("error-message").textContent = "No encontramos ese curso. Elige uno de los cursos disponibles.";
  if (!course) {
    document.title = "Aula sexto · Elige tu curso";
    if (focus) {
      byId("courses-title").tabIndex = -1;
      byId("courses-title").focus();
    }
    return;
  }
  document.title = `${course.title} · Aula sexto`;
  byId("course-title").textContent = course.title;
  byId("course-description").textContent = course.description;
  const subjects = byId("subjects");
  subjects.replaceChildren();
  for (const [index, subject] of courseSubjects().entries()) {
    const tile = element("article", "subject");
    tile.append(element("span", "subject-number", `MATERIA ${String(index + 1).padStart(2, "0")}`), element("h3", "", subject.title), element("p", "", subject.description));
    const button = element("button", "", "Explorar materia");
    button.type = "button";
    button.dataset.subject = subject.id;
    button.addEventListener("click", () => {
      Object.values(controls).forEach((control) => { control.value = ""; });
      state.openTopics.clear();
      selectSubject(subject.id);
      controls.search.focus();
    });
    tile.append(button);
    subjects.append(tile);
  }
  selectSubject(course.subjects[0]);
  if (focus) byId("course-title").focus();
}

async function fetchJson(path) {
  const response = await fetch(path, { credentials: "omit" });
  if (!response.ok) throw new Error(`No se pudo cargar ${path} (HTTP ${response.status}).`);
  return response.json();
}

async function load() {
  const workspace = document.querySelector(".workspace");
  workspace.setAttribute("aria-busy", "true");
  byId("load-error").hidden = true;
  byId("result-count").textContent = "Cargando ejercicios…";
  byId("print").disabled = true;
  byId("retry").disabled = true;
  try {
    const catalog = validateCatalog(await fetchJson("/data/catalog.json"));
    const files = await Promise.all(catalog.subjects.flatMap((subject) =>
      subject.topics.map(async (topic) => ({ subject, topic, data: await fetchJson(topic.file) }))));
    const seen = new Set();
    const exercises = files.flatMap(({ subject, topic, data }) =>
      validateTopic(data, topic, seen).exercises.map((exercise) => ({ ...exercise, topic: topic.id, subject: subject.id })));
    state.catalog = catalog;
    state.exercises = exercises;
    const courses = byId("courses");
    courses.replaceChildren();
    for (const course of catalog.courses) {
      const tile = element("article", "subject");
      const count = exercises.filter((exercise) => course.subjects.includes(exercise.subject)).length;
      tile.append(element("span", "subject-number", `${count} EJERCICIOS`), element("h3", "", course.title), element("p", "", course.description));
      const link = element("a", "course-link", `Entrar en ${course.title}`);
      link.href = `#/curso/${course.id}`;
      tile.append(link);
      courses.append(tile);
    }
    byId("catalog-status").textContent = `${catalog.courses.length} cursos disponibles. Elige tu curso para empezar.`;
    route();
  } catch (error) {
    state.catalog = null;
    state.exercises = [];
    state.course = null;
    byId("home-screen").hidden = false;
    byId("course-screen").hidden = true;
    byId("courses").replaceChildren();
    byId("catalog-status").textContent = "Los cursos no están disponibles.";
    byId("results").replaceChildren();
    byId("subjects").replaceChildren();
    byId("print-view").replaceChildren();
    byId("result-count").textContent = "Los ejercicios no están disponibles.";
    byId("error-message").textContent = "No hemos podido cargar contenido válido. Vuelve a intentarlo; si persiste, el responsable debe revisar los archivos.";
    byId("load-error").hidden = false;
    console.error("Error de contenido:", error);
  } finally {
    workspace.setAttribute("aria-busy", "false");
    byId("retry").disabled = false;
  }
}

byId("filters").addEventListener("submit", (event) => event.preventDefault());
controls.search.addEventListener("input", render);
controls.topic.addEventListener("change", render);
controls.difficulty.addEventListener("change", render);
byId("clear").addEventListener("click", () => {
  Object.values(controls).forEach((control) => { control.value = ""; });
  render();
});
byId("retry").addEventListener("click", load);
byId("print").addEventListener("click", () => window.print());
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  byId("main").focus();
});
window.addEventListener("hashchange", () => {
  if (!location.hash || location.hash.startsWith("#/")) route(true);
});
load();
