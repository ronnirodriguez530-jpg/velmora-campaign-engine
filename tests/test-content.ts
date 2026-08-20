import type { VelmoraContent } from "../src/domain/types.ts";

export function withOpeningTestTemplate(content: VelmoraContent): VelmoraContent {
  return {
    ...content,
    sceneTemplates: [{
      id: "TEST-SCENE-OPENING",
      stages: ["opening"],
      conflictKey: "test_opening_pressure",
      objectiveKey: "test_assess_current_location",
      minThreatLevel: 1,
      maxThreatLevel: 2
    }]
  };
}
