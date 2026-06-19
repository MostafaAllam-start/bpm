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
} from "../forms/types.ts";

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

const form = (
  titleEn: string,
  titleAr: string,
  elements: FormField[],
): FormSchema => ({ title: tx(titleEn, titleAr), pages: [{ name: "page1", elements }] });

export const EXAMPLE_FORMS: Record<string, Record<string, FormSchema>> = {
  "simple-linear": {
    Task_do: form("Do the work", "تنفيذ المهمة", [
      field("text", "summary", "Work summary", "ملخص العمل", { isRequired: true }),
      field("comment", "notes", "Notes", "ملاحظات"),
      field("boolean", "done", "Mark as complete", "وضع علامة كمكتمل"),
    ]),
  },

  approval: {
    Submit_request: form("Submit request", "تقديم الطلب", [
      field("text", "requester", "Requester", "مقدّم الطلب", { isRequired: true }),
      field("number", "amount", "Requested amount", "المبلغ المطلوب", { isRequired: true }),
      field("comment", "description", "Request details", "تفاصيل الطلب"),
    ]),
    Review: form("Review request", "مراجعة الطلب", [
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
    Validate: form("Validate order", "التحقق من الطلب", [
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
    Submit_request: form("Submit leave request", "تقديم طلب إجازة", [
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
    Collect_docs: form("Collect documents", "جمع المستندات", [
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
};
