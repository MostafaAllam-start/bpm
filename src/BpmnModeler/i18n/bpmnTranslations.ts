import type { ModuleDeclaration } from "didi";

import i18n from "../../i18n";

// bpmn-js, the properties panel and the token-simulation add-on resolve all of
// their own UI strings (palette tooltips, context-pad actions, properties-panel
// group/field labels, element type names, ...) through diagram-js's `translate`
// service. We override that service so those strings follow the app language.
//
// This maps the English source templates to Arabic; anything not listed falls
// back to the original English template.
const ar: Record<string, string> = {
  // Properties panel — groups & common fields
  General: "عام",
  Documentation: "التوثيق",
  Name: "الاسم",
  ID: "المعرّف",
  "Element documentation": "توثيق العنصر",
  Details: "التفاصيل",
  Type: "النوع",
  Value: "القيمة",
  Process: "العملية",
  Executable: "قابلة للتنفيذ",
  "Version tag": "وسم الإصدار",

  // Element type names (also shown as the panel header)
  "Start Event": "حدث البداية",
  "Intermediate Throw Event": "حدث وسيط (إطلاق)",
  "Intermediate Catch Event": "حدث وسيط (التقاط)",
  "End Event": "حدث النهاية",
  "Boundary Event": "حدث حدودي",
  Task: "مهمة",
  "User Task": "مهمة مستخدم",
  "Service Task": "مهمة خدمة",
  "Send Task": "مهمة إرسال",
  "Receive Task": "مهمة استلام",
  "Manual Task": "مهمة يدوية",
  "Business Rule Task": "مهمة قاعدة عمل",
  "Script Task": "مهمة نص برمجي",
  "Call Activity": "نشاط استدعاء",
  "Sub Process": "عملية فرعية",
  "Sub Process (collapsed)": "عملية فرعية (مطوية)",
  "Sub Process (expanded)": "عملية فرعية (موسّعة)",
  Transaction: "معاملة",
  "Event Sub Process": "عملية فرعية للأحداث",
  Gateway: "بوابة",
  "Exclusive Gateway": "بوابة حصرية",
  "Parallel Gateway": "بوابة متوازية",
  "Inclusive Gateway": "بوابة شاملة",
  "Complex Gateway": "بوابة معقّدة",
  "Event based Gateway": "بوابة قائمة على الأحداث",
  "Sequence Flow": "تدفق تسلسلي",
  "Message Flow": "تدفق رسائل",
  Association: "ارتباط",
  "Data Object Reference": "مرجع كائن بيانات",
  "Data Store Reference": "مرجع مخزن بيانات",
  Pool: "حوض",
  Participant: "مشارك",
  Lane: "مسار",
  Group: "مجموعة",
  "Text Annotation": "تعليق نصي",

  // Replace ("change element") menu — entries use sentence case, distinct from
  // the Title Case type names above.
  "Start event": "حدث بداية",
  "Intermediate throw event": "حدث وسيط (إطلاق)",
  "End event": "حدث نهاية",
  "Message start event": "حدث بداية برسالة",
  "Timer start event": "حدث بداية بمؤقّت",
  "Conditional start event": "حدث بداية مشروط",
  "Signal start event": "حدث بداية بإشارة",
  "Error start event": "حدث بداية بخطأ",
  "Escalation start event": "حدث بداية بتصعيد",
  "Compensation start event": "حدث بداية بتعويض",
  "Message start event (non-interrupting)": "حدث بداية برسالة (غير مقاطِع)",
  "Timer start event (non-interrupting)": "حدث بداية بمؤقّت (غير مقاطِع)",
  "Conditional start event (non-interrupting)": "حدث بداية مشروط (غير مقاطِع)",
  "Signal start event (non-interrupting)": "حدث بداية بإشارة (غير مقاطِع)",
  "Escalation start event (non-interrupting)": "حدث بداية بتصعيد (غير مقاطِع)",
  "Message intermediate catch event": "حدث وسيط لالتقاط رسالة",
  "Message intermediate throw event": "حدث وسيط لإطلاق رسالة",
  "Timer intermediate catch event": "حدث وسيط لالتقاط مؤقّت",
  "Escalation intermediate throw event": "حدث وسيط لإطلاق تصعيد",
  "Conditional intermediate catch event": "حدث وسيط لالتقاط شرط",
  "Link intermediate catch event": "حدث وسيط لالتقاط رابط",
  "Link intermediate throw event": "حدث وسيط لإطلاق رابط",
  "Compensation intermediate throw event": "حدث وسيط لإطلاق تعويض",
  "Signal intermediate catch event": "حدث وسيط لالتقاط إشارة",
  "Signal intermediate throw event": "حدث وسيط لإطلاق إشارة",
  "Message end event": "حدث نهاية برسالة",
  "Escalation end event": "حدث نهاية بتصعيد",
  "Error end event": "حدث نهاية بخطأ",
  "Cancel end event": "حدث نهاية بإلغاء",
  "Compensation end event": "حدث نهاية بتعويض",
  "Signal end event": "حدث نهاية بإشارة",
  "Terminate end event": "حدث نهاية بإنهاء",
  "Message boundary event": "حدث حدودي برسالة",
  "Timer boundary event": "حدث حدودي بمؤقّت",
  "Escalation boundary event": "حدث حدودي بتصعيد",
  "Conditional boundary event": "حدث حدودي مشروط",
  "Error boundary event": "حدث حدودي بخطأ",
  "Cancel boundary event": "حدث حدودي بإلغاء",
  "Signal boundary event": "حدث حدودي بإشارة",
  "Compensation boundary event": "حدث حدودي بتعويض",
  "Message boundary event (non-interrupting)": "حدث حدودي برسالة (غير مقاطِع)",
  "Timer boundary event (non-interrupting)": "حدث حدودي بمؤقّت (غير مقاطِع)",
  "Escalation boundary event (non-interrupting)":
    "حدث حدودي بتصعيد (غير مقاطِع)",
  "Conditional boundary event (non-interrupting)":
    "حدث حدودي مشروط (غير مقاطِع)",
  "Signal boundary event (non-interrupting)": "حدث حدودي بإشارة (غير مقاطِع)",
  "Exclusive gateway": "بوابة حصرية",
  "Parallel gateway": "بوابة متوازية",
  "Inclusive gateway": "بوابة شاملة",
  "Complex gateway": "بوابة معقّدة",
  "Event-based gateway": "بوابة قائمة على الأحداث",
  "Event based instantiating Gateway": "بوابة إنشاء قائمة على الأحداث",
  "Parallel Event based instantiating Gateway":
    "بوابة إنشاء متوازية قائمة على الأحداث",
  "Event sub-process": "عملية فرعية للأحداث",
  "Ad-hoc sub-process": "عملية فرعية مخصّصة",
  "Ad-hoc sub-process (collapsed)": "عملية فرعية مخصّصة (مطوية)",
  "Ad-hoc sub-process (expanded)": "عملية فرعية مخصّصة (موسّعة)",
  "Sub-process": "عملية فرعية",
  "Sub-process (collapsed)": "عملية فرعية (مطوية)",
  "Sub-process (expanded)": "عملية فرعية (موسّعة)",
  "User task": "مهمة مستخدم",
  "Service task": "مهمة خدمة",
  "Send task": "مهمة إرسال",
  "Receive task": "مهمة استلام",
  "Manual task": "مهمة يدوية",
  "Business rule task": "مهمة قاعدة عمل",
  "Script task": "مهمة نص برمجي",
  "Call activity": "نشاط استدعاء",
  "Data store reference": "مرجع مخزن بيانات",
  "Data object reference": "مرجع كائن بيانات",
  "Sequence flow": "تدفق تسلسلي",
  "Default flow": "تدفق افتراضي",
  "Conditional flow": "تدفق مشروط",
  "Expanded pool/participant": "حوض/مشارك موسّع",

  // Palette — tools
  "Activate hand tool": "تفعيل أداة اليد",
  "Activate lasso tool": "تفعيل أداة التحديد",
  "Activate create/remove space tool": "تفعيل أداة إنشاء/إزالة المساحة",
  "Activate global connect tool": "تفعيل أداة الربط العام",

  // Palette — create entries
  "Create start event": "إنشاء حدث بداية",
  "Create intermediate/boundary event": "إنشاء حدث وسيط/حدودي",
  "Create end event": "إنشاء حدث نهاية",
  "Create gateway": "إنشاء بوابة",
  "Create task": "إنشاء مهمة",
  "Create data object reference": "إنشاء مرجع كائن بيانات",
  "Create data store reference": "إنشاء مرجع مخزن بيانات",
  "Create expanded sub-process": "إنشاء عملية فرعية موسّعة",
  "Create pool/participant": "إنشاء حوض/مشارك",
  "Create group": "إنشاء مجموعة",

  // Context pad
  "Append task": "إلحاق مهمة",
  "Append end event": "إلحاق حدث نهاية",
  "Append gateway": "إلحاق بوابة",
  "Append intermediate/boundary event": "إلحاق حدث وسيط/حدودي",
  "Append text annotation": "إلحاق تعليق نصي",
  "Add text annotation": "إضافة تعليق نصي",
  "Change type": "تغيير النوع",
  "Change element": "تغيير العنصر",
  Connect: "ربط",
  "Connect using sequence/message flow or association":
    "الربط باستخدام تدفق تسلسلي/رسائل أو ارتباط",
  "Connect using association": "الربط باستخدام ارتباط",
  "Connect using data input association": "الربط باستخدام ارتباط إدخال بيانات",
  Delete: "حذف",
  Remove: "إزالة",

  // Token simulation — chrome, palette controls and log entries (these are
  // hardcoded in the add-on's DOM and translated via tokenSimulationI18n.ts).
  "Token Simulation": "محاكاة الرموز",
  "Toggle Token Simulation": "تبديل محاكاة الرموز",
  "Simulation Log": "سجل المحاكاة",
  "Toggle Simulation Log": "تبديل سجل المحاكاة",
  "No Entries": "لا توجد مدخلات",
  Close: "إغلاق",
  "Play/Pause Simulation": "تشغيل/إيقاف المحاكاة",
  "Reset Simulation": "إعادة تعيين المحاكاة",
  "Trigger Event": "تشغيل الحدث",
  "Set Sequence Flow": "تعيين تدفق التسلسل",
  "Add pause point": "إضافة نقطة توقف",
  "Remove pause point": "إزالة نقطة توقف",
  "Process started": "بدأت العملية",
  "Process finished": "انتهت العملية",
  "Process canceled": "أُلغيت العملية",
  Finished: "انتهى",
  "Intermediate Event": "حدث وسيط",
  SubProcess: "عملية فرعية",
};

const TABLES: Record<string, Record<string, string>> = { ar };

// Exact-match lookup of a single string in the active language (falls back to
// the original). Shared by the translate service and the token-simulation DOM
// translator.
export function translateBpmnString(text: string): string {
  const language = (i18n.resolvedLanguage ?? i18n.language ?? "en").split(
    "-",
  )[0];
  return TABLES[language]?.[text] ?? text;
}

// diagram-js translate signature: (template, replacements) => string.
export function bpmnTranslate(
  template: string,
  replacements?: Record<string, string>,
): string {
  return translateBpmnString(template).replace(
    /{([^}]+)}/g,
    (_, key: string) => replacements?.[key] ?? "{" + key + "}",
  );
}

// diagram-js module that replaces the default `translate` service.
const translateModule: ModuleDeclaration = {
  translate: ["value", bpmnTranslate],
};

export default translateModule;
