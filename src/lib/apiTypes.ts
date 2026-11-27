// Tipos del front que no son respuestas de la API. Las respuestas vienen de api.gen.ts (npm run api:types).
import type { SupplyResponse, UserResponse } from "./api.gen";

export type CurrentUser = UserResponse;

/** Insumo tal como llega: `packagePrice` es null sin precio cargado aunque el OpenAPI diga number (hallazgo). */
export type Insumo = Omit<SupplyResponse, "packagePrice"> & { packagePrice: number | null };
