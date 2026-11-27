// Salidas de la lista de súper en el navegador: portapapeles y PDF (jsPDF, cargado recién al tocar el botón).
import { feedback } from "./feedback";
import { textoLista, unaALaVez, type ListaSuper } from "./listaSuper";
import { dibujarListas } from "./pdfLista";

/** Sin await antes de writeText: iOS Safari rechaza el portapapeles fuera del gesto del usuario. */
export async function copiarLista(l: ListaSuper): Promise<void> {
  try {
    if (!navigator.clipboard) throw new Error("sin portapapeles");
    await navigator.clipboard.writeText(textoLista(l));
    feedback.success(`Lista de ${l.proveedor} copiada.`);
  } catch {
    feedback.error("No se pudo copiar la lista. Probá con el PDF.");
  }
}

/** Una página por proveedor; `archivo` sin ".pdf". Muestra el loader (el primer toque baja jsPDF) e ignora el doble toque. */
export const descargarPdf = unaALaVez(async (listas: ListaSuper[], archivo: string): Promise<void> => {
  feedback.begin();
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    dibujarListas(doc, listas);
    doc.save(`${archivo}.pdf`);
  } catch {
    feedback.error("No se pudo generar el PDF.");
  } finally {
    feedback.end();
  }
}, (_listas, archivo) => archivo);
