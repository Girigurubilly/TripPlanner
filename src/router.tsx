import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

function appBasepath() {
  const raw = import.meta.env.BASE_URL || "/";
  const trimmed = raw.replace(/\/$/, "");
  return trimmed || "/";
}

export function getRouter() {
  const basepath = appBasepath();
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    ...(basepath !== "/" ? { basepath } : {}),
  });
}
