import type { BpmnElementType } from "../../types/index.ts";
import { UserTaskIcon } from "./UserTaskIcon.tsx";
import { ServiceTaskIcon } from "./ServiceTaskIcon.tsx";
import { ManualTaskIcon } from "./ManualTaskIcon.tsx";
import { ScriptTaskIcon } from "./ScriptTaskIcon.tsx";
import { SendTaskIcon } from "./SendTaskIcon.tsx";
import { ReceiveTaskIcon } from "./ReceiveTaskIcon.tsx";
import { BusinessRuleTaskIcon } from "./BusinessRuleTaskIcon.tsx";
import { SendEmailTaskIcon } from "./SendEmailTaskIcon.tsx";
import { SendWhatsappTaskIcon } from "./SendWhatsappTaskIcon.tsx";
import { HttpConnectorTaskIcon } from "./HttpConnectorTaskIcon.tsx";

export function TaskIcon({ type }: { type: BpmnElementType }): React.ReactNode {
  switch (type) {
    case "userTask": return <UserTaskIcon />;
    case "serviceTask": return <ServiceTaskIcon />;
    case "manualTask": return <ManualTaskIcon />;
    case "scriptTask": return <ScriptTaskIcon />;
    case "sendTask": return <SendTaskIcon />;
    case "receiveTask": return <ReceiveTaskIcon />;
    case "businessRuleTask": return <BusinessRuleTaskIcon />;
    case "sendEmailTask": return <SendEmailTaskIcon />;
    case "sendWhatsappTask": return <SendWhatsappTaskIcon />;
    case "httpConnectorTask": return <HttpConnectorTaskIcon />;
    default: return null;
  }
}
