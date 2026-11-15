// Bloqueo de scroll compartido entre paneles: con animaciones de salida, dos paneles pueden convivir
// (ej. el detalle sale mientras entra la edición), así que se cuenta cuántos hay abiertos en vez de
// guardar/restaurar el valor en cada uno (eso dejaba el body en "hidden").

export function crearBloqueo(style: { overflow: string }) {
  let abiertos = 0;
  let previo = "";
  return () => {
    if (abiertos++ === 0) {
      previo = style.overflow;
      style.overflow = "hidden";
    }
    let liberado = false;
    return () => {
      if (liberado) return;
      liberado = true;
      if (--abiertos === 0) style.overflow = previo;
    };
  };
}
