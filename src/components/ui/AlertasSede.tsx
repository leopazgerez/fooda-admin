import { ALERTA_SEDE, etiqueta } from "@/lib/etiquetas";
import { Tag } from "./Erp";

/** Alertas de stock de una sede (low_stock, free_slots; /dashboard las manda en mayúsculas). */
export default function AlertasSede({ alerts }: { alerts: string[] }) {
  return <>{alerts.map((a) => <Tag key={a} tone={a.toLowerCase() === "low_stock" ? "danger" : "warning"}>{etiqueta(ALERTA_SEDE, a)}</Tag>)}</>;
}
