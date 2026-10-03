import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateCatalog, validateTopic } from "../public/assets/content-validation.js";

export async function readContent() {
  const root = new URL("../public/", import.meta.url);
  const catalog = validateCatalog(JSON.parse(await readFile(new URL("data/catalog.json", root), "utf8")));
  const seen = new Set();
  const exercises = [];
  for (const subject of catalog.subjects) {
    for (const topic of subject.topics) {
      const data = validateTopic(JSON.parse(await readFile(new URL(topic.file.slice(1), root), "utf8")), topic, seen);
      exercises.push(...data.exercises.map((exercise) => ({ ...exercise, topic: topic.id, subject: subject.id })));
    }
  }
  return { catalog, exercises };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { catalog, exercises } = await readContent();
  console.log(`${exercises.length} ejercicios válidos en ${catalog.subjects.length} materia(s).`);
}
