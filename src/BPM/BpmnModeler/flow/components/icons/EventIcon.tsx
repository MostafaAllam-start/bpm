import type { BpmnElementType } from "../../types/index.ts";
import { StartEventIcon } from "./StartEventIcon.tsx";
import { EndEventIcon } from "./EndEventIcon.tsx";
import { IntermediateEventIcon } from "./IntermediateEventIcon.tsx";

export function EventIcon({ type }: { type: BpmnElementType }): React.ReactNode {
  if (type === "startEvent") return <StartEventIcon />;
  if (type === "endEvent") return <EndEventIcon />;
  return <IntermediateEventIcon />;
}
