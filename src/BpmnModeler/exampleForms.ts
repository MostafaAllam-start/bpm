// Starter forms bundled with the example diagrams. Every actor element in an
// example arrives with a small, relevant form so opening the actor form (or
// running the simulation) shows something real rather than a blank starter.
//
// Forms ship bilingual: each piece of user-facing text is a `{ default, ar }`
// LocalizedText, so the form follows the app language at render time via
// `resolveText`. (The diagram XML uses `{{token}}` substitution for node names;
// these schemas don't need it because they carry both languages inline.)
//
// The map is keyed by example id → actor node id, matching the ids in the
// example XML (see `examples.ts`).

import type {
  Choice,
  FieldType,
  FormField,
  FormSchema,
  LocalizedText,
} from "@FormBuilder";

const tx = (en: string, ar: string): LocalizedText => ({ default: en, ar });

const choice = (value: string, en: string, ar: string): Choice => ({
  value,
  text: tx(en, ar),
});

const field = (
  type: FieldType,
  name: string,
  en: string,
  ar: string,
  extra: Partial<FormField> = {},
): FormField => ({ type, name, title: tx(en, ar), ...extra });

// A read-only dynamic-text block: bilingual display text whose `{variable}`
// tokens are resolved at render time against the form's own answers plus the
// in-scope process / upstream-form variables — so a downstream form can show
// the data the requester entered earlier (and process globals). Newlines are
// preserved (`.ff-dynamic-text` is `white-space: pre-wrap`).
const summary = (name: string, en: string, ar: string): FormField => ({
  type: "dynamictext",
  name,
  text: tx(en, ar),
});

// A static rich-text block (carries no answer). Content is HTML — not
// interpolated — so use it for headings/intros, and `summary` (dynamic text)
// when you need `{variable}` values.
const htmlBlock = (name: string, en: string, ar: string): FormField => ({
  type: "html",
  name,
  html: tx(en, ar),
});

// Responsive column span (out of 12) per breakpoint — drives the flow-layout
// grid so a field is, say, full width on mobile and a half from `sm` up. The
// override starts at `sm` (≥640px container) so it engages inside the runtime
// form modal, not only on very wide canvases. Only the breakpoints passed are
// set; the rest inherit the next smaller one.
const span = (base: number, sm?: number, lg?: number): FormField["colSpan"] => {
  const cols: NonNullable<FormField["colSpan"]> = { base };
  if (sm != null) cols.sm = sm;
  if (lg != null) cols.lg = lg;
  return cols;
};

// A titled section divider (carries no answer). Full width; renders as a section
// header that groups the fields placed after it. `collapsible` shows an
// expand/collapse caret on the visual design canvas.
const group = (
  name: string,
  en: string,
  ar: string,
  collapsible = false,
): FormField => ({
  type: "group",
  name,
  title: tx(en, ar),
  collapsible,
  colSpan: { base: 12 },
});

const form = (
  titleEn: string,
  titleAr: string,
  elements: FormField[],
): FormSchema => ({ title: tx(titleEn, titleAr), pages: [{ name: "page1", elements }] });

export const EXAMPLE_FORMS: Record<string, Record<string, FormSchema>> = {
  "simple-linear": {
    Start: form("Start request", "بدء الطلب", [
      field("text", "title", "Request title", "عنوان الطلب", { isRequired: true }),
      field("comment", "details", "Details", "التفاصيل"),
    ]),
    Task_do: form("Do the work", "تنفيذ المهمة", [
      summary(
        "requestInfo",
        "Request: {title}\nPriority: {priority}\nDetails: {details}",
        "الطلب: {title}\nالأولوية: {priority}\nالتفاصيل: {details}",
      ),
      field("text", "summary", "Work summary", "ملخص العمل", { isRequired: true }),
      field("comment", "notes", "Notes", "ملاحظات"),
      field("boolean", "done", "Mark as complete", "وضع علامة كمكتمل"),
    ]),
  },

  approval: {
    Start: form("Submit request", "تقديم الطلب", [
      field("text", "requester", "Requester", "مقدّم الطلب", { isRequired: true }),
      field("number", "amount", "Requested amount", "المبلغ المطلوب", { isRequired: true }),
      field("comment", "description", "Request details", "تفاصيل الطلب"),
    ]),
    Review: form("Review request", "مراجعة الطلب", [
      summary(
        "requestInfo",
        "Requester: {requester}\nAmount: {amount}\nCost center: {costCenter}\nDetails: {description}",
        "مقدّم الطلب: {requester}\nالمبلغ: {amount}\nمركز التكلفة: {costCenter}\nالتفاصيل: {description}",
      ),
      field("radiogroup", "recommendation", "Recommendation", "التوصية", {
        isRequired: true,
        choices: [
          choice("approve", "Approve", "موافقة"),
          choice("reject", "Reject", "رفض"),
        ],
      }),
      field("comment", "comments", "Comments", "ملاحظات"),
    ]),
    Notify_ok: form("Notify approval", "إشعار بالموافقة", [
      field("email", "recipient", "Recipient email", "بريد المستلم", { isRequired: true }),
      field("comment", "message", "Message", "الرسالة"),
    ]),
    Notify_no: form("Notify rejection", "إشعار بالرفض", [
      field("email", "recipient", "Recipient email", "بريد المستلم", { isRequired: true }),
      field("comment", "reason", "Reason", "السبب", { isRequired: true }),
    ]),
  },

  order: {
    Start: form("Create order", "إنشاء الطلب", [
      field("text", "orderRef", "Order reference", "مرجع الطلب", { isRequired: true }),
      field("number", "itemCount", "Number of items", "عدد العناصر", { isRequired: true }),
    ]),
    Validate: form("Validate order", "التحقق من الطلب", [
      summary(
        "orderInfo",
        "Order {orderRef}\nCustomer: {customerName}\nItems: {itemCount}\nWarehouse: {warehouse}",
        "الطلب {orderRef}\nالعميل: {customerName}\nعدد العناصر: {itemCount}\nالمستودع: {warehouse}",
      ),
      field("text", "orderId", "Order ID", "رقم الطلب", { isRequired: true }),
      field("boolean", "inStock", "All items in stock", "كل العناصر متوفرة"),
      field("comment", "notes", "Notes", "ملاحظات"),
    ]),
    Pack: form("Pack items", "تعبئة العناصر", [
      field("number", "boxes", "Number of boxes", "عدد الصناديق", { isRequired: true }),
      field("boolean", "fragile", "Contains fragile items", "تحتوي على عناصر قابلة للكسر"),
    ]),
    Pay: form("Process payment", "معالجة الدفع", [
      field("dropdown", "method", "Payment method", "طريقة الدفع", {
        isRequired: true,
        choices: [
          choice("card", "Card", "بطاقة"),
          choice("cash", "Cash", "نقدًا"),
          choice("transfer", "Bank transfer", "تحويل بنكي"),
        ],
      }),
      field("number", "amount", "Amount", "المبلغ", { isRequired: true }),
    ]),
    Ship: form("Ship order", "شحن الطلب", [
      field("text", "carrier", "Carrier", "شركة الشحن", { isRequired: true }),
      field("text", "tracking", "Tracking number", "رقم التتبع"),
    ]),
  },

  "leave-request": {
    Start: form("Submit leave request", "تقديم طلب إجازة", [
      field("date", "startDate", "Start date", "تاريخ البدء", { isRequired: true }),
      field("date", "endDate", "End date", "تاريخ الانتهاء", { isRequired: true }),
      field("dropdown", "leaveType", "Leave type", "نوع الإجازة", {
        isRequired: true,
        choices: [
          choice("annual", "Annual", "سنوية"),
          choice("sick", "Sick", "مرضية"),
          choice("unpaid", "Unpaid", "بدون راتب"),
        ],
      }),
      field("comment", "reason", "Reason", "السبب"),
    ]),
    Manager_review: form("Manager review", "مراجعة المدير", [
      summary(
        "leaveInfo",
        "Leave type: {leaveType}\nFrom {startDate} to {endDate}\nRequested days: {requestedDays}\nReason: {reason}",
        "نوع الإجازة: {leaveType}\nمن {startDate} إلى {endDate}\nعدد الأيام المطلوبة: {requestedDays}\nالسبب: {reason}",
      ),
      field("radiogroup", "decision", "Decision", "القرار", {
        isRequired: true,
        choices: [
          choice("approve", "Approve", "موافقة"),
          choice("reject", "Reject", "رفض"),
        ],
      }),
      field("comment", "managerComment", "Comment", "تعليق"),
    ]),
    Hr_record: form("Record in HR system", "التسجيل في نظام الموارد البشرية", [
      field("text", "employeeId", "Employee ID", "رقم الموظف", { isRequired: true }),
      field("boolean", "balanceUpdated", "Leave balance updated", "تم تحديث رصيد الإجازة"),
    ]),
  },

  onboarding: {
    Start: form("New hire details", "بيانات الموظف الجديد", [
      field("text", "candidateName", "Candidate name", "اسم المرشح", { isRequired: true }),
      field("email", "personalEmail", "Personal email", "البريد الشخصي", { isRequired: true }),
    ]),
    Collect_docs: form("Collect documents", "جمع المستندات", [
      summary(
        "hireInfo",
        "New hire: {candidateName}\nEmail: {personalEmail}\nCompany: {company}\nBuddy: {buddyName}",
        "الموظف الجديد: {candidateName}\nالبريد: {personalEmail}\nالشركة: {company}\nالموجّه: {buddyName}",
      ),
      field("text", "fullName", "Full name", "الاسم الكامل", { isRequired: true }),
      field("text", "nationalId", "National ID", "رقم الهوية", { isRequired: true }),
      field("fileupload", "documents", "Documents", "المستندات", { accept: ".pdf,image/*" }),
    ]),
    It_setup: form("IT account setup", "إعداد حساب تقنية المعلومات", [
      field("email", "email", "Work email", "البريد المهني", { isRequired: true }),
      field("dropdown", "laptopType", "Laptop", "الحاسوب المحمول", {
        choices: [
          choice("mac", "Mac", "ماك"),
          choice("windows", "Windows", "ويندوز"),
        ],
      }),
      field("boolean", "accessGranted", "System access granted", "تم منح صلاحية الوصول"),
    ]),
    Desk_setup: form("Prepare workspace", "تجهيز مكان العمل", [
      field("text", "deskLocation", "Desk location", "موقع المكتب", { isRequired: true }),
      field("boolean", "equipmentReady", "Equipment ready", "المعدات جاهزة"),
    ]),
    Orientation: form("Orientation session", "جلسة التعريف", [
      field("date", "sessionDate", "Session date", "تاريخ الجلسة", { isRequired: true }),
      field("comment", "notes", "Notes", "ملاحظات"),
    ]),
  },

  // A deliberately maximal six-form workflow (intake → screen → background +
  // verify → final decision → onboard). Across the forms every field type
  // appears, both API-backed data sources (an options dropdown and a display
  // table), dynamic-text interpolation, conditional logic and responsive column
  // spans are exercised, and EVERY form is organised into titled `group`
  // sections. The gateways branch on `eligibility` (Screen) and `finalDecision`
  // (Final).
  "applicant-processing": {
    Start: form("Application intake", "استمارة التقديم", [
      htmlBlock(
        "intro",
        "<p><strong>Welcome!</strong> This form exercises every field type. Fields reflow by screen size — try the responsive preview.</p>",
        "<p><strong>مرحبًا!</strong> تستعرض هذه الاستمارة كل أنواع الحقول. تتجاوب الحقول مع حجم الشاشة — جرّب المعاينة المتجاوبة.</p>",
      ),
      group("personalSection", "Personal information", "المعلومات الشخصية"),
      field("text", "fullName", "Full name", "الاسم الكامل", {
        isRequired: true,
        colSpan: span(12, 6),
      }),
      field("email", "email", "Email", "البريد الإلكتروني", {
        isRequired: true,
        colSpan: span(12, 6),
      }),
      field("number", "age", "Age", "العمر", { colSpan: span(12, 4) }),
      field("date", "birthDate", "Date of birth", "تاريخ الميلاد", { colSpan: span(12, 4) }),
      field("datetime", "appointment", "Preferred appointment", "الموعد المفضّل", { colSpan: span(12, 4) }),
      group("detailsSection", "Application details", "تفاصيل الطلب"),
      field("dropdown", "department", "Department", "القسم", {
        isRequired: true,
        colSpan: span(12, 6),
        choices: [
          choice("engineering", "Engineering", "الهندسة"),
          choice("sales", "Sales", "المبيعات"),
          choice("hr", "Human Resources", "الموارد البشرية"),
          choice("finance", "Finance", "المالية"),
        ],
      }),
      // Choice options fetched live from a test API.
      field("dropdown", "assignee", "Assign reviewer", "تعيين المراجع", {
        colSpan: span(12, 6),
        choicesSource: "api",
        choicesApi: {
          url: "https://jsonplaceholder.org/users",
          valueKey: "id",
          displayKey: "firstname",
        },
      }),
      field("radiogroup", "contactMethod", "Preferred contact", "وسيلة التواصل المفضّلة", {
        isRequired: true,
        colSpan: span(12, 6),
        choices: [
          choice("email", "Email", "البريد"),
          choice("phone", "Phone", "الهاتف"),
          choice("other", "Other", "أخرى"),
        ],
      }),
      // Shown and required only when "Other" is chosen above.
      field("text", "otherContact", "Other contact details", "تفاصيل تواصل أخرى", {
        colSpan: span(12, 6),
        visibleIf: "{contactMethod} = 'other'",
        requiredIf: "{contactMethod} = 'other'",
      }),
      group("prefsSection", "Preferences", "التفضيلات"),
      field("checkbox", "interests", "Subscriptions", "الاشتراكات", {
        colSpan: span(12, 6),
        choices: [
          choice("news", "Newsletter", "النشرة الإخبارية"),
          choice("product", "Product updates", "تحديثات المنتج"),
          choice("events", "Events", "الفعاليات"),
        ],
      }),
      field("boolean", "subscribe", "Receive notifications", "تلقّي الإشعارات", { colSpan: span(12, 6) }),
      field("rating", "satisfaction", "Overall satisfaction", "الرضا العام", {
        rateMax: 5,
        colSpan: span(12, 6),
      }),
      field("comment", "bio", "About you", "نبذة عنك", { colSpan: span(12) }),
      group("docsSection", "Documents", "المستندات"),
      field("fileupload", "resume", "Résumé", "السيرة الذاتية", {
        accept: ".pdf,.doc,.docx",
        colSpan: span(12, 6),
      }),
      field("imageupload", "photo", "Profile photo", "الصورة الشخصية", { colSpan: span(12, 6) }),
      field("signatureupload", "applicantSignature", "Signature", "التوقيع", { colSpan: span(12) }),
      group("addressSection", "Address", "العنوان", true),
      field("text", "street", "Street", "الشارع", { colSpan: span(12, 6) }),
      field("text", "city", "City", "المدينة", { colSpan: span(12, 4) }),
      field("text", "postalCode", "Postal code", "الرمز البريدي", { colSpan: span(12, 2) }),
      summary(
        "liveSummary",
        "You are applying as {fullName} ({email}) to {department} in region {region}.",
        "أنت تتقدّم باسم {fullName} ({email}) إلى {department} في منطقة {region}.",
      ),
    ]),

    Screen: form("Screen application", "فحص الطلب", [
      group("eligSection", "Eligibility check", "التحقق من الأهلية"),
      summary(
        "screenSummary",
        "Applicant: {fullName} ({email}) — {department}",
        "المتقدّم: {fullName} ({email}) — {department}",
      ),
      field("radiogroup", "eligibility", "Eligibility", "الأهلية", {
        isRequired: true,
        colSpan: span(12, 6),
        choices: [
          choice("eligible", "Eligible", "مؤهّل"),
          choice("ineligible", "Not eligible", "غير مؤهّل"),
        ],
      }),
      field("number", "creditScore", "Credit score", "درجة الائتمان", { colSpan: span(12, 6) }),
      group("screenNotesSection", "Reviewer notes", "ملاحظات المراجع"),
      field("comment", "screeningNotes", "Screening notes", "ملاحظات الفحص", { colSpan: span(12) }),
      field("boolean", "flagged", "Flag for attention", "وضع علامة للمتابعة", { colSpan: span(12, 6) }),
    ]),

    Background: form("Background check", "التحقق من الخلفية", [
      group("idSection", "Identity", "الهوية"),
      field("text", "idNumber", "ID number", "رقم الهوية", {
        isRequired: true,
        colSpan: span(12, 6),
      }),
      field("dropdown", "idType", "ID type", "نوع الهوية", {
        colSpan: span(12, 6),
        choices: [
          choice("passport", "Passport", "جواز سفر"),
          choice("national", "National ID", "بطاقة وطنية"),
          choice("license", "Driver's license", "رخصة قيادة"),
        ],
      }),
      group("historySection", "Checks", "الفحوصات"),
      field("checkbox", "checksPerformed", "Checks performed", "الفحوصات المنفّذة", {
        colSpan: span(12),
        choices: [
          choice("criminal", "Criminal record", "السجل الجنائي"),
          choice("employment", "Employment history", "تاريخ التوظيف"),
          choice("education", "Education", "التعليم"),
        ],
      }),
      field("radiogroup", "bgResult", "Result", "النتيجة", {
        isRequired: true,
        colSpan: span(12, 6),
        choices: [
          choice("clear", "Clear", "خالٍ"),
          choice("issues", "Issues found", "وُجدت مشكلات"),
        ],
      }),
      field("comment", "findings", "Findings", "النتائج", { colSpan: span(12) }),
    ]),

    Verify: form("Verify documents", "التحقق من المستندات", [
      group("checklistSection", "Document checklist", "قائمة المستندات"),
      field("checkbox", "documentsReceived", "Documents received", "المستندات المستلمة", {
        colSpan: span(12),
        choices: [
          choice("id", "ID document", "وثيقة الهوية"),
          choice("address", "Proof of address", "إثبات العنوان"),
          choice("income", "Proof of income", "إثبات الدخل"),
        ],
      }),
      group("verifySection", "Verification", "التحقق"),
      field("boolean", "allValid", "All documents valid", "جميع المستندات صحيحة", { colSpan: span(12, 6) }),
      field("fileupload", "verifiedScan", "Verified scan", "نسخة موثّقة", {
        accept: ".pdf,image/*",
        colSpan: span(12, 6),
      }),
      field("comment", "verifyNotes", "Verification notes", "ملاحظات التحقق", { colSpan: span(12) }),
    ]),

    Final: form("Final decision", "القرار النهائي", [
      htmlBlock(
        "finalHeading",
        "<h3>Final decision</h3><p>Reviewer: <em>{reviewerName}</em> · Form {formVersion}</p>",
        "<h3>القرار النهائي</h3><p>المراجع: <em>{reviewerName}</em> · النموذج {formVersion}</p>",
      ),
      group("summarySection", "Application summary", "ملخص الطلب"),
      summary(
        "applicantSummary",
        "Applicant: {fullName}\nEmail: {email}\nDepartment: {department}\nEligibility: {eligibility}\nBackground: {bgResult}",
        "المتقدّم: {fullName}\nالبريد: {email}\nالقسم: {department}\nالأهلية: {eligibility}\nالخلفية: {bgResult}",
      ),
      // Manual table whose cells interpolate the captured answers/globals.
      {
        type: "table",
        name: "summaryTable",
        tableSource: "manual",
        tableHeader: true,
        tableColumns: [tx("Field", "الحقل"), tx("Value", "القيمة")],
        tableRows: [
          [tx("Name", "الاسم"), tx("{fullName}", "{fullName}")],
          [tx("Email", "البريد"), tx("{email}", "{email}")],
          [tx("Region", "المنطقة"), tx("{region}", "{region}")],
        ],
        colSpan: span(12),
      },
      group("refSection", "Reference data", "بيانات مرجعية"),
      // Reference data fetched live from a test API.
      {
        type: "table",
        name: "directoryTable",
        tableSource: "api",
        tableHeader: true,
        tableColumns: [
          tx("First name", "الاسم الأول"),
          tx("Last name", "اسم العائلة"),
          tx("Email", "البريد"),
        ],
        tableApi: {
          url: "https://jsonplaceholder.org/users",
          columnKeys: ["firstname", "lastname", "email"],
        },
        colSpan: span(12),
      },
      {
        type: "image",
        name: "banner",
        src: "https://dummyimage.com/600x200/4f46e5/ffffff&text=Showcase",
        alt: tx("Banner", "لافتة"),
        colSpan: span(12, 6),
      },
      {
        type: "iframe",
        name: "locationMap",
        src: "https://www.openstreetmap.org/export/embed.html?bbox=-0.16%2C51.48%2C-0.06%2C51.53&layer=mapnik",
        height: 240,
        colSpan: span(12, 6),
      },
      group("decisionSection", "Decision", "القرار"),
      // Display-only signature bound to the acting reviewer.
      {
        type: "signature",
        name: "reviewerSeal",
        signatureSource: "currentActor",
        colSpan: span(12),
      },
      field("radiogroup", "finalDecision", "Decision", "القرار", {
        isRequired: true,
        colSpan: span(12, 6),
        choices: [
          choice("approve", "Approve", "موافقة"),
          choice("reject", "Reject", "رفض"),
        ],
      }),
      // Shown only when approving.
      field("number", "approvedAmount", "Approved amount", "المبلغ المعتمد", {
        colSpan: span(12, 6),
        visibleIf: "{finalDecision} = 'approve'",
        requiredIf: "{finalDecision} = 'approve'",
      }),
      field("comment", "reviewNotes", "Review notes", "ملاحظات المراجعة", { colSpan: span(12) }),
    ]),

    Onboard: form("Onboard applicant", "تهيئة المتقدّم", [
      group("accountSection", "Account setup", "إعداد الحساب"),
      field("email", "workEmail", "Work email", "البريد المهني", {
        isRequired: true,
        colSpan: span(12, 6),
      }),
      field("text", "username", "Username", "اسم المستخدم", {
        isRequired: true,
        colSpan: span(12, 6),
      }),
      field("date", "startDate", "Start date", "تاريخ المباشرة", {
        isRequired: true,
        colSpan: span(12, 6),
      }),
      group("equipmentSection", "Equipment", "المعدات"),
      field("dropdown", "laptop", "Laptop", "الحاسوب المحمول", {
        colSpan: span(12, 6),
        choices: [
          choice("mac", "Mac", "ماك"),
          choice("windows", "Windows", "ويندوز"),
          choice("linux", "Linux", "لينكس"),
        ],
      }),
      field("boolean", "accessGranted", "System access granted", "تم منح صلاحية الوصول", { colSpan: span(12, 6) }),
      field("comment", "onboardNotes", "Onboarding notes", "ملاحظات التهيئة", { colSpan: span(12) }),
    ]),
  },
};
