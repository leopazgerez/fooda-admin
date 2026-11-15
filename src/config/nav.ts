import {
  BarChart3, Carrot, ChefHat, LayoutDashboard, Package, Settings,
  ShoppingCart, Store, Users, Wallet, type LucideIcon,
} from "lucide-react";

export interface NavLink { name: string; href: string; icon: LucideIcon }
/** A labelled block of links in the sidebar. */
export interface NavSection { label: string; items: NavLink[] }

/** Sidebar menu. Add one entry per module. */
export const nav: NavSection[] = [
  { label: "VISIÓN GENERAL", items: [{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "OPERACIONES",
    items: [
      { name: "Compras", href: "/compras", icon: ShoppingCart },
      { name: "Producción", href: "/produccion", icon: ChefHat },
      { name: "Inventario y traslados", href: "/stock", icon: Package },
    ],
  },
  {
    label: "VENTAS",
    items: [
      { name: "Ventas", href: "/ventas", icon: Store },
      { name: "Clientes", href: "/clientes", icon: Users },
    ],
  },
  {
    label: "GESTIÓN",
    items: [
      { name: "Finanzas y Caja", href: "/finanzas", icon: Wallet },
      { name: "Catálogo", href: "/catalogo", icon: Carrot },
      { name: "Análisis", href: "/analisis", icon: BarChart3 },
    ],
  },
  {
    label: "CONFIGURACIÓN",
    items: [
      { name: "Ajustes", href: "/ajustes", icon: Settings },
    ],
  },
];

/** Mobile bottom bar (design: Dashboard (Mobile)). The last tab, "Más", opens the sidebar. */
export const bottomNav: NavLink[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Producción", href: "/produccion", icon: ChefHat },
  { name: "Inventario", href: "/stock", icon: Package },
  { name: "Venta", href: "/ventas", icon: Store },
];
