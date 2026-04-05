export function aiManifest(): string {
  return JSON.stringify(
    {
      $schema: "https://raw.githubusercontent.com/tr-io/agentic-harness/main/manifest-schema.json",
      mappings: [],
      generatedAt: new Date().toISOString(),
      note: "Add mappings as you document the codebase. Each mapping links source paths to the .ai/ docs that cover them.",
    },
    null,
    2,
  );
}
