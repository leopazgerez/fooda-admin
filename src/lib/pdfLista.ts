// Dibujo del PDF de la lista de súper. La fuente estándar de jsPDF (WinAnsi) no tiene ☐ ni ≈: las casillas se dibujan
// y el pie dice "aprox." (ponytail: embeber Inter si hace falta el mismo texto que al copiar).
import type { jsPDF } from "jspdf";
import type { ListaSuper } from "./listaSuper";

// jsPDF no lee CSS: hex de --text-primary y --brand-dark (globals.css)
const TEXTO = "#1C1917";
const TITULO = "#2B2522";
const MARGEN = 15;
const ANCHO = 210;
const ALTO = 297;
const FILA = 9;

/** Dibuja una página por lista en `doc` (A4 en mm). Sin imports de runtime: se puede correr con node para revisar el PDF. */
export function dibujarListas(doc: jsPDF, listas: ListaSuper[]): void {
  const derecha = ANCHO - MARGEN;
  const encabezado = (l: ListaSuper, cont: boolean) => {
    let y = MARGEN + 5;
    doc.setTextColor(TITULO).setFont("helvetica", "bold").setFontSize(18).text("FOODA · Lista de compras", MARGEN, y);
    y += 8;
    const sub: string[] = doc.setTextColor(TEXTO).setFont("helvetica", "normal").setFontSize(12)
      .splitTextToSize(cont ? `${l.subtitulo} (continúa)` : l.subtitulo, derecha - MARGEN);
    doc.text(sub, MARGEN, y);
    y += sub.length * 5 + 7;
    doc.setFontSize(14).setDrawColor(TEXTO).setLineWidth(0.3);
    return y;
  };
  listas.forEach((l, n) => {
    if (n) doc.addPage();
    let y = encabezado(l, false);
    for (const i of l.items) {
      // nombre hasta x≈103 mm: la cantidad (alineada a 150) tiene ~45 mm sin pisarlo
      const nombre: string[] = doc.splitTextToSize(i.nombre, 80);
      if (y + nombre.length * 6 > ALTO - MARGEN - 15) {
        doc.addPage();
        y = encabezado(l, true);
      }
      doc.rect(MARGEN, y - 4, 4.5, 4.5);
      doc.text(nombre, MARGEN + 8, y);
      doc.text(i.cantidad, 150, y, { align: "right" });
      doc.text(i.importe, derecha, y, { align: "right" });
      y += Math.max(FILA, nombre.length * 6 + 3);
    }
    doc.line(MARGEN, y - 3, derecha, y - 3);
    y += 5;
    doc.setFont("helvetica", "bold").text(`Llevar aprox. ${l.llevar}  (aprox. ${l.packs} packs)`, MARGEN, y);
  });
}
