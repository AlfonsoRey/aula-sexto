export const LEVELS = Object.freeze({ inicial: "Inicial", intermedio: "Intermedio", reto: "Reto" });
const slugPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function check(condition, message) {
  if (!condition) throw new Error(message);
}
function object(value, label) {
  check(value !== null && typeof value === "object" && !Array.isArray(value), `${label}: debe ser un objeto`);
}
function text(value, label, max = 3000) {
  check(typeof value === "string" && value.trim().length > 0 && value.length <= max, `${label}: texto vacío o demasiado largo`);
  check(!/<\/?[a-z][^>]*>/i.test(value), `${label}: no se permite HTML`);
}
function slug(value, label) {
  text(value, label, 80);
  check(slugPattern.test(value), `${label}: identificador inválido`);
}
function list(value, label, max = 200) {
  check(Array.isArray(value) && value.length > 0 && value.length <= max, `${label}: lista vacía o demasiado larga`);
}
function sourceUrl(value, label) {
  text(value, label, 1000);
  const url = new URL(value);
  check(url.protocol === "https:" && !url.username && !url.password && !url.port &&
    ["recursos.edu.xunta.gal", "www.edu.xunta.gal"].includes(url.hostname), `${label}: URL de fuente no permitida`);
}
function verifiedDate(value, label) {
  check(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
  `${label}: fecha de comprobación inválida`);
}
function exerciseSource(source, id) {
  object(source, `${id}: fuente`);
  sourceUrl(source.url, `${id}: URL del original`);
  sourceUrl(source.recordUrl, `${id}: URL de la ficha`);
  for (const key of ["author", "title", "locator", "adaptation"]) text(source[key], `${id}: ${key}`);
  check(source.license === "CC BY-NC-SA (versión no indicada en la ficha); adaptación bajo la misma licencia",
    `${id}: licencia de reproducción no verificada`);
  verifiedDate(source.verifiedOn, id);
}

export function validateCatalog(catalog) {
  object(catalog, "Catálogo");
  check(catalog.version === 2, "Versión de catálogo no compatible");
  list(catalog.subjects, "Materias", 30);
  const ids = new Set();
  const topics = new Set();
  for (const subject of catalog.subjects) {
    object(subject, "Materia");
    slug(subject.id, "Materia id");
    check(!ids.has(subject.id), `Materia duplicada: ${subject.id}`);
    ids.add(subject.id);
    text(subject.title, "Título de materia", 120);
    text(subject.description, "Descripción de materia");
    list(subject.topics, "Temas", 40);
    for (const topic of subject.topics) {
      object(topic, "Tema");
      slug(topic.id, "Tema id");
      check(!topics.has(topic.id), `Tema duplicado: ${topic.id}`);
      topics.add(topic.id);
      text(topic.title, "Título de tema", 120);
      text(topic.description, "Descripción de tema");
      if (topic.requiresSource !== undefined) check(typeof topic.requiresSource === "boolean", `Fuente requerida inválida: ${topic.id}`);
      check(topic.file === `/data/${subject.id}/${topic.id}.json`, `Ruta de tema inválida: ${topic.id}`);
    }
  }
  list(catalog.courses, "Cursos", 12);
  const courses = new Set();
  const assigned = new Set();
  for (const course of catalog.courses) {
    object(course, "Curso");
    slug(course.id, "Curso id");
    check(!courses.has(course.id), `Curso duplicado: ${course.id}`);
    courses.add(course.id);
    text(course.title, "Título de curso", 120);
    text(course.region, "Territorio del curso", 120);
    text(course.description, "Descripción de curso");
    list(course.subjects, "Materias del curso", 30);
    for (const id of course.subjects) {
      check(ids.has(id), `Materia de curso inexistente: ${id}`);
      check(!assigned.has(id), `Materia asignada a más de un curso: ${id}`);
      assigned.add(id);
    }
  }
  check(assigned.size === ids.size, "Hay materias sin curso");
  return catalog;
}

export function validateTopic(data, topic, seen = new Set()) {
  object(data, `Archivo ${topic.id}`);
  check(data.topic === topic.id, `El archivo no corresponde al tema ${topic.id}`);
  check(Array.isArray(data.exercises) && data.exercises.length <= 200, `Ejercicios de ${topic.id}: lista inválida`);
  if (data.resources !== undefined) list(data.resources, `Recursos de ${topic.id}`, 40);
  check(data.exercises.length > 0 || data.resources?.length > 0, `Tema ${topic.id}: lista vacía`);
  for (const resource of data.resources || []) {
    object(resource, "Recurso externo");
    slug(resource.id, "Recurso id");
    check(!seen.has(resource.id), `Recurso duplicado: ${resource.id}`);
    seen.add(resource.id);
    text(resource.title, `${resource.id}: título`, 160);
    text(resource.statement, `${resource.id}: descripción`);
    list(resource.tags, `${resource.id}: etiquetas`, 12);
    resource.tags.forEach((tag) => text(tag, "Etiqueta de recurso", 80));
    for (const key of ["difficulty", "solution", "steps", "hints", "chart"]) {
      check(resource[key] === undefined, `${resource.id}: un recurso externo no es un ejercicio (${key})`);
    }
    object(resource.source, `${resource.id}: procedencia`);
    sourceUrl(resource.source.url, "URL del documento");
    if (resource.source.recordUrl !== undefined) sourceUrl(resource.source.recordUrl, "URL de la ficha");
    for (const key of ["publisher", "locator", "language", "published", "license", "notes"]) {
      text(resource.source[key], `${resource.id}: ${key}`);
    }
    verifiedDate(resource.source.verifiedOn, resource.id);
  }
  for (const exercise of data.exercises) {
    object(exercise, "Ejercicio");
    slug(exercise.id, "Ejercicio id");
    check(!seen.has(exercise.id), `Ejercicio duplicado: ${exercise.id}`);
    seen.add(exercise.id);
    text(exercise.title, `${exercise.id}: título`, 160);
    check(Object.hasOwn(LEVELS, exercise.difficulty), `${exercise.id}: dificultad inválida`);
    text(exercise.statement, `${exercise.id}: enunciado`);
    text(exercise.solution, `${exercise.id}: solución`);
    if (topic.requiresSource || exercise.source !== undefined) exerciseSource(exercise.source, exercise.id);
    for (const key of ["hints", "steps", "tags"]) {
      list(exercise[key], `${exercise.id}: ${key}`, key === "tags" ? 12 : 20);
      exercise[key].forEach((value) => text(value, `${exercise.id}: ${key}`, key === "tags" ? 80 : 3000));
    }
    if (exercise.chart !== undefined) {
      object(exercise.chart, `${exercise.id}: gráfico`);
      text(exercise.chart.caption, "Título de gráfico", 160);
      text(exercise.chart.categoryLabel, "Etiqueta de categorías", 80);
      text(exercise.chart.valueLabel, "Etiqueta de valores", 80);
      list(exercise.chart.values, "Datos de gráfico", 20);
      const labels = new Set();
      for (const item of exercise.chart.values) {
        object(item, "Dato de gráfico");
        text(item.label, "Etiqueta de gráfico", 80);
        check(!labels.has(item.label), "Etiqueta de gráfico duplicada");
        labels.add(item.label);
        check(Number.isFinite(item.value) && item.value >= 0 && item.value <= 1000000, "Valor de gráfico inválido");
      }
    }
  }
  return data;
}
