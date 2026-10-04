import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { readContent } from "../scripts/validate-content.mjs";
import { validateCatalog, validateTopic } from "../public/assets/content-validation.js";
import { matches, normalize } from "../public/assets/practice.js";

const { catalog, exercises } = await readContent();
const byId = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));
const format = (value, decimals = 0) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: 3, useGrouping: value >= 10000 }).format(value);

test("43 ejercicios de sexto y 20 de tercero, cubiertos por colecciones protegidas", async () => {
  assert.equal(exercises.length, 63);
  assert.equal(exercises.filter((exercise) => exercise.subject === "matematicas").length, 43);
  assert.equal(exercises.filter((exercise) => exercise.topic === "repaso-sexto").length, 10);
  assert.equal(exercises.filter((exercise) => exercise.subject === "matematicas-tercero").length, 20);
  const initial = exercises.filter((exercise) => exercise.subject === "matematicas" && exercise.topic !== "repaso-sexto");
  for (const level of ["inicial", "intermedio", "reto"]) assert.equal(initial.filter((exercise) => exercise.difficulty === level).length, 11);
  const config = parse(await readFile(new URL("../editor/assets/config.yml", import.meta.url), "utf8"));
  assert.equal(config.publish_mode, "editorial_workflow");
  assert.equal(config.backend.repo, "AlfonsoRey/aula-sexto");
  const files = config.collections.flatMap((collection) => {
    assert.equal(collection.publish, false);
    return collection.files;
  });
  for (const subject of catalog.subjects) {
    for (const topic of subject.topics) assert.ok(files.some((file) => file.file === `public${topic.file}`), topic.id);
  }
});

const calculations = [
  ["suma-resta", 36483 + 27935 - 8769, 55649],
  ["producto-descompuesto", 246 * 38, 9348],
  ["division-exacta", 7560 / 24, 315],
  ["fraccion-cantidad", 280 * 3 / 4, 210],
  ["producto-decimal", 1275 * 32 / 1000, 40.8],
  ["division-decimal", 5832 / 120, 48.6],
  ["descuento-bicicleta", 24000 * 15 / 100 / 100, 36],
  ["descuento-bicicleta", (24000 - 3600) / 100, 204],
  ["pasta-personas", 300 / 4 * 7, 525],
  ["distancias-unidades", (3450 + 825) / 1000, 4.275],
  ["horas-minutos", 2.5 * 60, 150],
  ["rectangulo-medidas", 2 * (12.5 + 8), 41],
  ["rectangulo-medidas", 12.5 * 8, 100],
  ["triangulo-area", 14 * 9 / 2, 63],
  ["caja-volumen", 8 * 5 * 3, 120],
  ["notas-estadistica", (6 + 8 + 7 + 9 + 10) / 5, 8],
  ["notas-estadistica", [6, 8, 7, 9, 10].sort((a, b) => a - b)[2], 8],
  ["compra-cambio", (1000 - (3 * 240 + 185)) / 100, .95, 2],
  ["serie-productos", 30 + 12, 42],
  ["serie-doble", 65 * 2 - 1, 129],
  ["libros-aventuras", 18 / 24 * 100, 75],
  ["entradas-iguales", 10000 / 8 * 5 / 100, 62.5, 2],
  ["superficie-unidades", .36 * 10000, 3600],
  ["angulo-triangulo", 180 - 55 - 65, 60],
  ["cuadrado-inverso", 36 / 4, 9],
  ["cuadrado-inverso", (36 / 4) ** 2, 81],
  ["patas-animales", 8 * 2 + 3 * 4, 28],
  ["palillos-cuadrados", 4 + 5 * 3, 19],
  ["redondeo-centesimas", Math.round(18746 / 10) / 100, 18.75],
  ["sexto-prioridad", 18 + 6 * (14 - 9), 48],
  ["sexto-primos", 2 ** 2 * 3 * 7, 84],
  ["sexto-primos", 2 ** 2 * 3, 12],
  ["sexto-fraccion-restante", 160 * 5 / 8, 100],
  ["sexto-fraccion-restante", 160 - 100, 60],
  ["sexto-descuentos-sucesivos", 8000 * .8 * .9 / 100, 57.6, 2],
  ["sexto-descuentos-sucesivos", 80 * .7, 56],
  ["sexto-escala", 6.5 * 1000 / 100, 65],
  ["sexto-capacidad", 4 * 1.5 * 1000 / 250, 24],
  ["sexto-area-compuesta", 9 * 4 + 3 * 2, 42],
  ["tercero-valor-posicional", 4 * 1000 + 2 * 100 + 6 * 10 + 3, 4263],
  ["tercero-suma", 248 + 175, 423],
  ["tercero-resta", 602 - 278, 324],
  ["tercero-multiplicacion", 24 * 6, 144],
  ["tercero-division", 56 / 7, 8],
  ["tercero-mitad", 18 / 2, 9],
  ["tercero-autobuses", 3 * 28 - 76, 8],
  ["tercero-bolsas", Math.floor(29 / 4), 7],
  ["tercero-bolsas", 29 % 4, 1],
  ["tercero-comparacion", 135 - 98, 37],
  ["tercero-centimetros", 2 * 100 + 35, 235],
  ["tercero-peso", 1000 + 250, 1250],
  ["tercero-litros", 3 * 2, 6],
  ["tercero-reloj", 55 - 20, 35],
  ["tercero-dinero", (200 + 75) / 100, 2.75, 2],
  ["tercero-dinero", (500 - 200 - 75) / 100, 2.25, 2],
  ["tercero-perimetro", 7 + 4 + 7 + 4, 22],
  ["tercero-patron", 30 + 5, 35],
  ["tercero-patron", 30 + 5 + 5, 40]
];
for (const [id, actual, expected, decimals] of calculations) {
  test(`Resultado vinculado al contenido ${id}: ${expected}`, () => {
    assert.ok(Math.abs(actual - expected) < 1e-9);
    assert.ok(byId[id].solution.replaceAll(" ", "").includes(format(expected, decimals).replaceAll(".", "")), byId[id].solution);
  });
}
test("Fracciones, divisibilidad, cifras, orden y datos", () => {
  assert.ok(byId["fraccion-irreducible"].solution.includes("3/4"));
  assert.equal(42 / 56, 3 / 4);
  assert.ok(byId["sumar-fracciones"].solution.includes("3/2"));
  assert.ok(Math.abs(2 / 3 + 5 / 6 - 3 / 2) < 1e-9);
  assert.ok(byId["agua-deposito"].solution.includes("7/10"));
  assert.ok(Math.abs(4 / 5 - 1 / 10 - 7 / 10) < 1e-9);
  const common = Array.from({ length: 54 }, (_, i) => i + 1).find((n) => n % 12 === 0 && n % 18 === 0);
  assert.equal(common, 36);
  assert.ok(byId["avisos-coincidentes"].solution.includes(String(common)));
  const numbers = Array.from({ length: 90 }, (_, i) => i + 10).filter((n) => Math.floor(n / 10) === 2 * (n % 10) && Math.floor(n / 10) + n % 10 === 9);
  assert.deepEqual(numbers, [63]);
  assert.ok(byId["numero-cifras"].solution.includes(String(numbers[0])));
  assert.ok(byId["cola-tres"].solution.includes(["Lucía", "Marcos", "Nora"][1]));
  const data = byId["prestamos-grafico"].chart.values;
  assert.equal(data.reduce((sum, item) => sum + item.value, 0), 54);
  assert.equal(data.toSorted((a, b) => b.value - a.value)[0].label, "Martes");
  assert.ok(byId["prestamos-grafico"].solution.includes("54"));
  assert.ok(byId["fichas-probabilidad"].solution.includes("3/8"));
  assert.equal(3 / (3 + 5), 3 / 8);
});
test("Búsqueda con acentos, combinada, sin buscar soluciones", () => {
  assert.equal(normalize("  TRIÁNGULO  "), "triangulo");
  const filters = { subject: "", topic: "geometria", difficulty: "intermedio", search: "triangulo area" };
  assert.deepEqual(exercises.filter((exercise) => matches(exercise, filters)).map((exercise) => exercise.id), ["triangulo-area"]);
  assert.equal(matches(byId["serie-doble"], { search: "129" }), false);
});
test("Referencias de cursos únicas, existentes y completas", () => {
  assert.equal(catalog.version, 2);
  assert.deepEqual(catalog.courses.map((course) => course.id), ["sexto", "tercero"]);
  for (const change of [
    (copy) => { copy.courses[1].id = "sexto"; },
    (copy) => { copy.courses[0].subjects.push("no-existe"); },
    (copy) => { copy.courses[1].subjects = ["matematicas"]; },
    (copy) => { copy.courses.pop(); }
  ]) {
    const invalid = structuredClone(catalog);
    change(invalid);
    assert.throws(() => validateCatalog(invalid));
  }
});
test("Resultados no numéricos y razonamientos nuevos", () => {
  assert.ok(byId["tercero-cuartos"].solution.includes("1/4"));
  assert.ok(byId["tercero-cuartos"].solution.includes("3/4"));
  assert.ok(byId["tercero-poligono"].solution.includes("pentágono"));
  assert.ok(byId["tercero-poligono"].solution.includes("5 vértices"));
  assert.ok(byId["tercero-numero-misterio"].solution.includes(String(40 + (10 - 4))));
  assert.ok(byId["sexto-probabilidad-complemento"].solution.includes("2/3"));
  assert.equal((3 + 5) / (4 + 3 + 5), 2 / 3);
  const votes = byId["tercero-tabla"].chart.values;
  const total = votes.reduce((sum, item) => sum + item.value, 0);
  assert.equal(total, 20);
  assert.ok(byId["tercero-tabla"].solution.includes(String(total)));
  assert.equal(votes.toSorted((a, b) => b.value - a.value)[0].label, "Manzana");
  const readings = [3, 5, 4, 5, 6, 5, 7];
  assert.equal(readings.filter((n) => n === 5).length, 3);
  assert.ok(byId["sexto-moda"].solution.includes("5 libros"));
  assert.ok(byId["sexto-moda"].solution.includes("3 veces"));
  const arrival = 9 * 60 + 45 + 2 * 60 + 35;
  assert.ok(byId["sexto-tiempo-viaje"].solution.includes(`${Math.floor(arrival / 60)}:${arrival % 60}`));
});
test("Rechazar rutas ajenas, duplicados, dificultad y contenido HTML", () => {
  const invalid = structuredClone(catalog);
  invalid.subjects[0].topics[0].file = "https://otro.example/data.json";
  assert.throws(() => validateCatalog(invalid), /Ruta/);
  const topic = catalog.subjects[0].topics[0];
  const data = { topic: topic.id, exercises: [structuredClone(byId["suma-resta"])] };
  data.exercises[0].difficulty = "__proto__";
  assert.throws(() => validateTopic(data, topic), /dificultad/);
  data.exercises[0].difficulty = "inicial";
  data.exercises[0].statement = "<img src=x onerror=alert(1)>";
  assert.throws(() => validateTopic(data, topic), /HTML/);
  data.exercises[0].statement = "Texto";
  data.exercises.push(structuredClone(data.exercises[0]));
  assert.throws(() => validateTopic(data, topic), /duplicado/);
});
