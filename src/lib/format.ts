// Display helpers shared across screens.

export const money = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("es-AR");

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

/** Purchase quantity: grams switch to Kg from 1000; units read "N Unidades". */
export const qty = (n: number, unit: "gr" | "un") =>
  unit === "un"
    ? `${n} Unidades`
    : n >= 1000 ? `${(n / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} Kg` : `${n} gr`;
