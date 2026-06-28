import type { BpmnElementType } from "../../types/index.ts";
import { ExclusiveGatewaySymbol } from "./ExclusiveGatewaySymbol.tsx";
import { ParallelGatewaySymbol } from "./ParallelGatewaySymbol.tsx";
import { InclusiveGatewaySymbol } from "./InclusiveGatewaySymbol.tsx";
import { EventBasedGatewaySymbol } from "./EventBasedGatewaySymbol.tsx";

export function GatewaySymbol({ type }: { type: BpmnElementType }): React.ReactNode {
  switch (type) {
    case "parallelGateway": return <ParallelGatewaySymbol />;
    case "inclusiveGateway": return <InclusiveGatewaySymbol />;
    case "eventBasedGateway": return <EventBasedGatewaySymbol />;
    default: return <ExclusiveGatewaySymbol />;
  }
}
