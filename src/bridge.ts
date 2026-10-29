import type { Request } from "./types";
export const isDesktop = () => "__TAURI_INTERNALS__" in window;
export async function api<T = unknown>(request: Request): Promise<T> {
  if (!isDesktop())
    throw new Error(
      "Desktop runtime required. Open the installed Kremen Learn application to use the local compiler and files.",
    );
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>("dispatch", { request });
}
