import type { NextConfig } from "next";

// In GitHub Actions the workflow passes the base path reported by GitHub Pages: "/<repo>" on
// <user>.github.io, "" with a custom domain (site served at the root). Never guess it from the repo name.
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

// Next.js requirement: basePath must start with a slash and must NOT end with a slash, nor be "/"
const formatBasePath = (path?: string): string | undefined => {
  if (!path || path.trim() === "" || path.trim() === "/") return undefined;
  let formatted = path.trim();
  if (!formatted.startsWith("/")) formatted = `/${formatted}`;
  if (formatted.endsWith("/")) formatted = formatted.slice(0, -1);
  return formatted;
};

const basePath = formatBasePath(rawBasePath);

const nextConfig: NextConfig = {
  // Expose basePath reliably to client-side bundles
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath || "",
  },

  // Enables static HTML export for GitHub Pages
  output: "export",

  // GitHub Pages does not have a dynamic image optimization server
  images: {
    unoptimized: true,
  },

  // Base path for GitHub Pages (e.g. /m-3-b-admin) or custom domain
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,

  // Generates trailing slashes for each route (e.g. /productos/index.html), essential for static host routing
  trailingSlash: true,

  // Dev only: allow opening `npm run dev` through an ngrok tunnel (the subdomain changes on every session)
  allowedDevOrigins: ["*.ngrok-free.app"],
};

export default nextConfig;
