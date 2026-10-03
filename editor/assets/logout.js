try {
  localStorage.clear();
  sessionStorage.clear();
  document.getElementById("logout-status").textContent = "Se han eliminado las credenciales locales de este origen. Cierra todas las ventanas del editor y cierra también Access con el enlace siguiente.";
} catch (error) {
  document.getElementById("logout-status").textContent = "El navegador no permite borrar el almacenamiento. Elimina los datos de este sitio manualmente y cierra las ventanas del editor.";
  console.error("No se ha podido eliminar el almacenamiento del editor.", error.name);
}
