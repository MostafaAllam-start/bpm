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
  Version: "الإصدار",

  // Properties panel — group titles added by the Zeebe properties provider
  // (registered to surface the sequence-flow "Condition expression" field).
  Condition: "الشرط",
  "Condition expression": "التعبير الشرطي",
  Implementation: "آلية التنفيذ",
  "Task definition": "تعريف المهمة",
  Assignment: "الإسناد",
  Form: "النموذج",
  "Called decision": "القرار المُستدعَى",
  "Called element": "العنصر المُستدعَى",
  Script: "النص البرمجي",
  "Input mapping": "تعيين المُدخلات",
  "Output mapping": "تعيين المُخرَجات",
  "Input propagation": "نشر المُدخلات",
  "Output propagation": "نشر المُخرَجات",
  Headers: "الرؤوس",
  "Task listeners": "مُستمِعات المهام",
  "Execution listeners": "مُستمِعات التنفيذ",
  "Extension properties": "خصائص التوسعة",
  "Active elements": "العناصر النشِطة",
  "Output collection": "مجموعة المُخرَجات",

  // Zeebe — field labels
  "Job type": "نوع المهمة",
  "Job worker": "مُنفِّذ المهمة",
  Retries: "عدد المحاولات",
  "Result variable": "متغيِّر النتيجة",
  "Process ID": "مُعرِّف العملية",
  "Decision ID": "مُعرِّف القرار",
  "Event type": "نوع الحدث",
  "Listener type": "نوع المُستمِع",
  "FEEL expression": "تعبير FEEL",
  Expression: "التعبير",
  Assignee: "المُسنَد إليه",
  "Candidate groups": "المجموعات المُرشَّحة",
  "Candidate users": "المستخدمون المُرشَّحون",
  Priority: "الأولويّة",
  "Due date": "تاريخ الاستحقاق",
  "Follow up date": "تاريخ المتابعة",
  "Form ID": "مُعرِّف النموذج",
  "Form JSON configuration": "إعدادات النموذج (JSON)",
  "Camunda user task": "مهمّة مستخدم Camunda",
  Binding: "الارتباط",
  "Variable name": "اسم المتغيِّر",
  "Variable assignment value": "قيمة إسناد المتغيِّر",
  "Propagate all variables": "نشر جميع المتغيِّرات",
  Source: "المصدر",
  Target: "الوجهة",
  Key: "المفتاح",
  "Input element": "عنصر المُدخلات",
  "Output element": "عنصر المُخرَجات",
  "Completion condition": "شرط الإكمال",

  // Zeebe — timer-event titles, labels & hints
  Cycle: "الدورة",
  Date: "التاريخ",
  Duration: "المدّة",
  "Timer documentation": "توثيق المؤقِّت",
  "How to configure a timer": "كيفية إعداد المؤقِّت",
  "UTC time": "التوقيت العالمي المنسَّق (UTC)",
  "UTC plus 2 hours zone offset":
    "إزاحة بمقدار ساعتين عن التوقيت العالمي (UTC+2)",
  "A cycle defined as ISO 8601 repeating intervals format, or a cron expression.":
    "دورة مُعرَّفة وفق صيغة الفترات المتكرِّرة ISO 8601، أو تعبير cron.",
  "A specific point in time defined as ISO 8601 combined date and time representation.":
    "نقطة زمنيّة محدَّدة مُعرَّفة وفق صيغة التاريخ والوقت المُدمَجة ISO 8601.",
  "A time duration defined as ISO 8601 durations format.":
    "مدّة زمنيّة مُعرَّفة وفق صيغة المُدد ISO 8601.",

  // Zeebe — listener event-type options (dropdowns). The labels are resolved at
  // runtime then passed through `translate`, so they are keyed by their English
  // label here.
  Start: "بداية",
  End: "نهاية",
  Cancel: "إلغاء",
  "Before all": "قبل الكل",
  "Before each": "قبل كل تكرار",
  "After each": "بعد كل تكرار",
  Creating: "عند الإنشاء",
  Assigning: "عند الإسناد",
  Updating: "عند التحديث",
  Completing: "عند الإكمال",
  Canceling: "عند الإلغاء",

  // Zeebe — execution-listener list-item titles (built as `<event>: {type}`).
  "Start: {type}": "بداية: {type}",
  "End: {type}": "نهاية: {type}",
  "Cancel: {type}": "إلغاء: {type}",
  "Before all: {type}": "قبل الكل: {type}",
  "Before each: {type}": "قبل كل تكرار: {type}",
  "After each: {type}": "بعد كل تكرار: {type}",

  // Properties panel — generic list/section controls (base panel UI)
  Create: "إنشاء",
  "Create new list item": "إنشاء عنصر جديد",
  "Delete item": "حذف العنصر",
  "Toggle list item": "طيّ/فتح العنصر",
  "Toggle section": "طيّ/فتح القسم",
  "List contains {numOfItems} item": "تحتوي القائمة على {numOfItems} عنصر",
  "List contains {numOfItems} items": "تحتوي القائمة على {numOfItems} عنصر",
  "<none>": "<لا شيء>",
  "<empty>": "<فارغ>",

  // Zeebe — timer example values (shown as hints in timer fields)
  "1 hour and 30 minutes": "ساعة و30 دقيقة",
  "14 days": "14 يومًا",
  "15 seconds": "15 ثانية",
  "every 10 seconds, up to 5 times": "كل 10 ثوانٍ، حتى 5 مرّات",
  "every day, infinitely": "كل يوم، بلا نهاية",
  "every hour on the hour from 9-5 p.m. UTC Monday-Friday":
    "كل ساعة عند رأس الساعة من 9 صباحًا حتى 5 مساءً بتوقيت UTC من الإثنين إلى الجمعة",

  // Zeebe — form, multi-instance, message & call-activity fields
  "Camunda Form": "نموذج Camunda",
  "Camunda Form (embedded)": "نموذج Camunda (مُضمَّن)",
  "Camunda Form (linked)": "نموذج Camunda (مرتبط)",
  "Custom form key": "مفتاح نموذج مخصّص",
  "External form reference": "مرجع نموذج خارجي",
  Code: "الرمز",
  "Input collection": "مجموعة المُدخلات",
  "Subscription correlation key": "مفتاح ارتباط الاشتراك",
  "Variable events": "أحداث المتغيِّر",
  Update: "تحديث",
  On: "تشغيل",
  Off: "إيقاف",
  "Propagate all child process variables":
    "نشر جميع متغيِّرات العملية الفرعية",
  "Propagate all parent process variables":
    "نشر جميع متغيِّرات العملية الأصل",
  "If turned on, all variables from the child process instance will be propagated to the parent process instance.":
    "عند التفعيل، تُنشَر جميع المتغيِّرات من نسخة العملية الفرعية إلى نسخة العملية الأصل.",
  "If turned on, all variables from the parent process instance will be propagated to the child process instance.":
    "عند التفعيل، تُنشَر جميع المتغيِّرات من نسخة العملية الأصل إلى نسخة العملية الفرعية.",
  "Otherwise, only variables defined via input mappings will be propagated.":
    "وإلّا، فلن يُنشَر سوى المتغيِّرات المُعرَّفة عبر تعيينات المُدخلات.",
  "Otherwise, only variables defined via output mappings will be propagated.":
    "وإلّا، فلن يُنشَر سوى المتغيِّرات المُعرَّفة عبر تعيينات المُخرَجات.",

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
  "Set color": "تعيين اللون",

  // Color picker — swatch names (bpmn-js-color-picker)
  Default: "افتراضي",
  Blue: "أزرق",
  Orange: "برتقالي",
  Green: "أخضر",
  Red: "أحمر",
  Purple: "بنفسجي",

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
