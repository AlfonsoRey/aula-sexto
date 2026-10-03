if (!window.CMS) {
  document.body.textContent = "No se pudo cargar Decap. El responsable debe ejecutar npm run editor:prepare y revisar los assets.";
  console.error("No se ha cargado la dependencia Decap.");
} else {
  window.CMS.registerMediaLibrary({
    name: "disabled",
    init() {
      return {
        enableStandalone: () => false,
        show() { throw new Error("Este editor solo admite contenido de texto, no archivos multimedia."); },
        hide() {}
      };
    }
  });
  window.CMS.init();
}
