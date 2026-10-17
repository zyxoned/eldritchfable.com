export async function loadCatalog(signal) {
  const response = await fetch("/api/catalog", {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal
  });
  if (!response.ok) throw new Error("Catalog request failed");
  const data = await response.json();
  if (!Array.isArray(data.products) || !Array.isArray(data.collections)) {
    throw new Error("Invalid catalog response");
  }
  return data;
}
