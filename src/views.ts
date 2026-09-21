import type { ViewDefinition } from "./types.ts";

export const VIEW_DEFINITIONS: readonly ViewDefinition[] = [
  { id: "product", label: "Product", regions: ["intent", "product", "quality"] },
  { id: "business", label: "Business", regions: ["business", "intent", "product"] },
  { id: "workflow", label: "Workflow", regions: ["workflow", "product", "business"] },
  { id: "domain", label: "Domain", regions: ["domain", "business", "workflow"] },
  { id: "experience", label: "Experience", regions: ["experience", "workflow", "domain", "product"] },
  { id: "architecture", label: "Architecture", regions: ["architecture", "domain", "experience", "quality"] },
];
