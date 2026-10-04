export class OAuthSessions {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    if (request.method !== "POST") return new Response("Método no permitido", { status: 405 });
    const path = new URL(request.url).pathname;
    if (path === "/create") {
      const record = await request.json();
      if (typeof record.sub !== "string" || !record.sub || !Number.isFinite(record.expires)) {
        return new Response("Sesión inválida", { status: 400 });
      }
      const created = await this.storage.transaction(async (transaction) => {
        if (await transaction.get("session")) return false;
        await transaction.put("session", record);
        return true;
      });
      if (!created) return new Response("Sesión existente", { status: 409 });
      await this.storage.setAlarm(record.expires);
      return new Response(null, { status: 201 });
    }
    if (path === "/consume") {
      const record = await this.storage.transaction(async (transaction) => {
        const stored = await transaction.get("session");
        await transaction.delete("session");
        return stored;
      });
      return record ? Response.json(record) : new Response("Sesión no disponible", { status: 410 });
    }
    return new Response("Ruta no encontrada", { status: 404 });
  }

  async alarm() {
    await this.storage.deleteAll();
  }
}
