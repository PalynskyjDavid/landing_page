const container = document.querySelector("#swagger-ui");

try {
  const response = await fetch("/docs/openapi.json");
  if (!response.ok) throw new Error(`Contract could not be loaded (${response.status}).`);
  const spec = await response.json();
  document.querySelector("#api-target").textContent = spec.servers[0].url;
  window.SwaggerUIBundle({
    spec,
    dom_id: "#swagger-ui",
    deepLinking: true,
    withCredentials: true,
    // Never upload this private API contract to Swagger's public validator.
    validatorUrl: null,
    queryConfigEnabled: false,
    supportedSubmitMethods: ["get", "post"],
  });
} catch (error) {
  container.setAttribute("role", "alert");
  container.textContent = `API documentation failed to load: ${error.message}`;
}
