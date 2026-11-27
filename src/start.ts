import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
  // Keep the Start entry dependency-free. Some Node deployment bundles expose
  // middleware helpers inconsistently during module initialization. Request
  // failures are normalized by the server entry wrapper instead.
  requestMiddleware: [],
}));
