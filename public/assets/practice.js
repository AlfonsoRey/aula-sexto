export function normalize(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").trim();
}

export function matches(exercise, filters) {
  if (filters.subject && exercise.subject !== filters.subject) return false;
  if (filters.topic && exercise.topic !== filters.topic) return false;
  if (filters.difficulty && exercise.difficulty !== filters.difficulty) return false;
  const searchable = normalize([exercise.title, exercise.statement, ...exercise.tags].join(" "));
  return normalize(filters.search).split(/\s+/).every((word) => searchable.includes(word));
}
