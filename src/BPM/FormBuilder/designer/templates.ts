// Pre-built form templates. Each descriptor provides i18n keys (resolved under
// "designer.templates.*") and a `build(t)` factory that follows the exact same
// pattern as `buildInitialSchema` in starter.ts: it returns a bare FormSchema
// with only title + pages[0].elements (and submittable where needed). All layout,
// canvas, submit, and titleBox values are intentionally omitted — the store's
// normalize() / ensureLayout() path backfills them on model.load(), exactly like
// opening a JSON file or pressing "New".

import type { TFunction } from "i18next";
import type { FormSchema, LocalizedText } from "../types";

export type TemplateDescriptor = {
  id: string;
  labelKey: string;       // i18n key under "designer.templates"
  descriptionKey: string; // i18n key under "designer.templates"
  mode?: "form" | "email" | "pdf"; // defaults to "form"
  build: (t: TFunction) => FormSchema;
};

// Resolve a form-namespace key in both languages into a LocalizedText.
function tx(t: TFunction, key: string, opts?: Record<string, unknown>): LocalizedText {
  return {
    default: t(key, { ...opts, lng: "en" }),
    ar: t(key, { ...opts, lng: "ar" }),
  };
}

function defaultChoices(t: TFunction, keys: [string, string][]): Array<{ value: string; text: LocalizedText }> {
  return keys.map(([value, key]) => ({ value, text: tx(t, key) }));
}

export const TEMPLATES: TemplateDescriptor[] = [
  // ── Contact Form ───────────────────────────────────────────────────────
  {
    id: "contact",
    labelKey: "contact",
    descriptionKey: "contactDesc",
    build: (t) => ({
      title: tx(t, "designer.templates.contact"),
      pages: [{
        name: "page1",
        elements: [
          { type: "text",    name: "fullName", title: tx(t, "defaults.name"),           isRequired: true },
          { type: "email",   name: "email",    title: tx(t, "defaults.email") },
          { type: "text",    name: "phone",    title: tx(t, "designer.templates.fieldPhone"),   inputType: "tel" },
          { type: "comment", name: "message",  title: tx(t, "designer.templates.fieldMessage") },
        ],
      }],
    }),
  },

  // ── Job Application ────────────────────────────────────────────────────
  {
    id: "job-application",
    labelKey: "jobApplication",
    descriptionKey: "jobApplicationDesc",
    build: (t) => ({
      title: tx(t, "designer.templates.jobApplication"),
      pages: [{
        name: "page1",
        elements: [
          { type: "text",       name: "fullName",   title: tx(t, "defaults.name"),                        isRequired: true },
          { type: "email",      name: "email",       title: tx(t, "defaults.email"),                       isRequired: true },
          { type: "dropdown",   name: "position",    title: tx(t, "designer.templates.fieldPosition"),
            choices: defaultChoices(t, [
              ["engineer", "designer.templates.optEngineer"],
              ["designer", "designer.templates.optDesigner"],
              ["manager",  "designer.templates.optManager"],
              ["other",    "designer.templates.optOther"],
            ]),
          },
          { type: "number",     name: "experience",  title: tx(t, "designer.templates.fieldExperience") },
          { type: "fileupload", name: "cv",           title: tx(t, "designer.templates.fieldCV"),     accept: ".pdf,.doc,.docx" },
          { type: "comment",    name: "coverLetter",  title: tx(t, "designer.templates.fieldCoverLetter") },
        ],
      }],
    }),
  },

  // ── Feedback Form ──────────────────────────────────────────────────────
  {
    id: "feedback",
    labelKey: "feedback",
    descriptionKey: "feedbackDesc",
    build: (t) => ({
      title: tx(t, "designer.templates.feedback"),
      pages: [{
        name: "page1",
        elements: [
          { type: "rating",      name: "satisfaction", title: tx(t, "designer.templates.fieldSatisfaction"), rateMax: 5, isRequired: true },
          { type: "dropdown",    name: "category",     title: tx(t, "designer.templates.fieldCategory"),
            choices: defaultChoices(t, [
              ["product",  "designer.templates.optProduct"],
              ["support",  "designer.templates.optSupport"],
              ["billing",  "designer.templates.optBilling"],
              ["other",    "designer.templates.optOther"],
            ]),
          },
          { type: "comment",     name: "comments",     title: tx(t, "designer.templates.fieldComments") },
          { type: "boolean",     name: "recommend",    title: tx(t, "designer.templates.fieldRecommend") },
        ],
      }],
    }),
  },

  // ── Event Registration ─────────────────────────────────────────────────
  {
    id: "event-registration",
    labelKey: "eventRegistration",
    descriptionKey: "eventRegistrationDesc",
    build: (t) => ({
      title: tx(t, "designer.templates.eventRegistration"),
      pages: [{
        name: "page1",
        elements: [
          { type: "text",     name: "fullName",  title: tx(t, "defaults.name"),                        isRequired: true },
          { type: "email",    name: "email",      title: tx(t, "defaults.email"),                       isRequired: true },
          { type: "number",   name: "attendees",  title: tx(t, "designer.templates.fieldAttendees") },
          { type: "dropdown", name: "dietary",    title: tx(t, "designer.templates.fieldDietary"),
            choices: defaultChoices(t, [
              ["none",       "designer.templates.optNone"],
              ["vegetarian", "designer.templates.optVegetarian"],
              ["vegan",      "designer.templates.optVegan"],
              ["gluten",     "designer.templates.optGlutenFree"],
            ]),
          },
          { type: "comment",  name: "notes",      title: tx(t, "designer.templates.fieldNotes") },
        ],
      }],
    }),
  },

  // ── Leave Request ──────────────────────────────────────────────────────
  {
    id: "leave-request",
    labelKey: "leaveRequest",
    descriptionKey: "leaveRequestDesc",
    build: (t) => ({
      title: tx(t, "designer.templates.leaveRequest"),
      pages: [{
        name: "page1",
        elements: [
          { type: "text",     name: "fullName",   title: tx(t, "defaults.name"),                      isRequired: true },
          { type: "dropdown", name: "department",  title: tx(t, "designer.templates.fieldDepartment"),
            choices: defaultChoices(t, [
              ["hr",          "designer.templates.optHR"],
              ["engineering", "designer.templates.optEngineering"],
              ["sales",       "designer.templates.optSales"],
              ["finance",     "designer.templates.optFinance"],
            ]),
          },
          { type: "date",     name: "startDate",   title: tx(t, "designer.templates.fieldStartDate"), isRequired: true },
          { type: "date",     name: "endDate",     title: tx(t, "designer.templates.fieldEndDate"),   isRequired: true },
          { type: "comment",  name: "reason",      title: tx(t, "designer.templates.fieldReason") },
        ],
      }],
    }),
  },

  // ── Quick Survey ───────────────────────────────────────────────────────
  {
    id: "survey",
    labelKey: "survey",
    descriptionKey: "surveyDesc",
    build: (t) => ({
      title: tx(t, "designer.templates.survey"),
      pages: [{
        name: "page1",
        elements: [
          { type: "html",        name: "header",  html: tx(t, "designer.templates.surveyHeader") },
          { type: "radiogroup",  name: "q1",      title: tx(t, "designer.templates.surveyQ1"), isRequired: true,
            choices: defaultChoices(t, [
              ["agree",    "designer.templates.optAgree"],
              ["neutral",  "designer.templates.optNeutral"],
              ["disagree", "designer.templates.optDisagree"],
            ]),
          },
          { type: "rating",      name: "q2",      title: tx(t, "designer.templates.surveyQ2"), rateMax: 5 },
          { type: "comment",     name: "q3",      title: tx(t, "designer.templates.surveyQ3") },
        ],
      }],
    }),
  },

  // ── Approval Dialog (modal, not submittable) ───────────────────────────
  {
    id: "approval-buttons",
    labelKey: "approvalButtons",
    descriptionKey: "approvalButtonsDesc",
    build: (t) => ({
      title: tx(t, "designer.templates.approvalButtons"),
      submittable: false,
      pages: [{
        name: "page1",
        elements: [
          {
            type: "dynamictext",
            name: "message",
            text: tx(t, "designer.templates.approvalMessage"),
          },
          {
            type: "button",
            name: "approve",
            title: tx(t, "designer.templates.btnApprove"),
            variant: "primary" as const,
            closeOnClick: true,
            assignments: [{ variable: "decision", value: "approved" }],
          },
          {
            type: "button",
            name: "reject",
            title: tx(t, "designer.templates.btnReject"),
            variant: "danger" as const,
            closeOnClick: true,
            assignments: [{ variable: "decision", value: "rejected" }],
          },
        ],
      }],
    }),
  },

  // ── Approval Form (submittable) — form mode ───────────────────────────
  {
    id: "approval-form",
    labelKey: "approvalForm",
    descriptionKey: "approvalFormDesc",
    build: (t) => ({
      title: tx(t, "designer.templates.approvalForm"),
      pages: [{
        name: "page1",
        elements: [
          {
            type: "dynamictext",
            name: "message",
            text: tx(t, "designer.templates.approvalFormMessage"),
          },
          {
            type: "radiogroup",
            name: "decision",
            title: tx(t, "designer.templates.fieldDecision"),
            isRequired: true,
            choices: [
              { value: "approved", text: tx(t, "designer.templates.btnApprove") },
              { value: "rejected", text: tx(t, "designer.templates.btnReject") },
            ],
          },
          {
            type: "comment",
            name: "reason",
            title: tx(t, "designer.templates.fieldReason"),
          },
        ],
      }],
    }),
  },

  // ── Email templates ────────────────────────────────────────────────────
  {
    id: "email-welcome",
    labelKey: "emailWelcome",
    descriptionKey: "emailWelcomeDesc",
    mode: "email",
    build: (t) => ({
      title: tx(t, "designer.templates.emailWelcome"),
      pages: [{
        name: "page1",
        elements: [
          {
            type: "heading",
            name: "header",
            title: { default: "Welcome to Our Platform!", ar: "مرحبًا بك في منصتنا!" },
          },
          { type: "divider", name: "sep1" },
          {
            type: "dynamictext",
            name: "body",
            text: { default: "Hello {recipient_name},\n\nThank you for joining us. We're excited to have you on board.", ar: "مرحبًا {recipient_name}،\n\nشكرًا لانضمامك. يسعدنا وجودك معنا." },
          },
          {
            type: "html",
            name: "cta",
            html: "<p style='text-align:center;margin:24px 0'><a href='#' style='background:#4f46e5;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600'>Get Started</a></p>",
          },
          { type: "divider", name: "sep2" },
          {
            type: "html",
            name: "footer",
            html: "<p style='color:#888;font-size:12px;text-align:center'>© {{company_name}} · <a href='#'>Unsubscribe</a></p>",
          },
        ],
      }],
    }),
  },

  {
    id: "email-notification",
    labelKey: "emailNotification",
    descriptionKey: "emailNotificationDesc",
    mode: "email",
    build: (t) => ({
      title: tx(t, "designer.templates.emailNotification"),
      pages: [{
        name: "page1",
        elements: [
          {
            type: "heading",
            name: "header",
            title: { default: "Action Required", ar: "يلزم اتخاذ إجراء" },
          },
          {
            type: "dynamictext",
            name: "body",
            text: { default: "{task_name} requires your attention.", ar: "{task_name} يستدعي اهتمامك." },
          },
          {
            type: "html",
            name: "details",
            html: "<p>Please log in to review the request and take the appropriate action.</p>",
          },
          {
            type: "html",
            name: "cta",
            html: "<p style='text-align:center;margin:20px 0'><a href='#' style='background:#4f46e5;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600'>Review Now</a></p>",
          },
        ],
      }],
    }),
  },

  {
    id: "email-newsletter",
    labelKey: "emailNewsletter",
    descriptionKey: "emailNewsletterDesc",
    mode: "email",
    build: (t) => ({
      title: tx(t, "designer.templates.emailNewsletter"),
      pages: [{
        name: "page1",
        elements: [
          {
            type: "heading",
            name: "title",
            title: { default: "Newsletter Title", ar: "عنوان النشرة الإخبارية" },
          },
          {
            type: "dynamictext",
            name: "subtitle",
            text: { default: "Issue #1 · {month} {year}", ar: "العدد #1 · {month} {year}" },
          },
          { type: "divider", name: "sep1" },
          {
            type: "html",
            name: "article",
            html: "<h3>Main Story Headline</h3><p>Write your main article content here. Keep it concise and engaging for your readers.</p>",
          },
          { type: "divider", name: "sep2" },
          {
            type: "html",
            name: "footer",
            html: "<p style='color:#888;font-size:12px;text-align:center'>You received this email because you subscribed. <a href='#'>Unsubscribe</a></p>",
          },
        ],
      }],
    }),
  },

  // ── PDF templates ──────────────────────────────────────────────────────
  {
    id: "pdf-report",
    labelKey: "pdfReport",
    descriptionKey: "pdfReportDesc",
    mode: "pdf",
    build: (t) => ({
      title: tx(t, "designer.templates.pdfReport"),
      pages: [{
        name: "page1",
        elements: [
          {
            type: "heading",
            name: "title",
            title: { default: "Report Title", ar: "عنوان التقرير" },
          },
          {
            type: "dynamictext",
            name: "meta",
            text: { default: "Prepared by: {author}  |  Date: {date}", ar: "أعده: {author}  |  التاريخ: {date}" },
          },
          { type: "divider", name: "sep1" },
          {
            type: "heading",
            name: "summaryTitle",
            title: { default: "Executive Summary", ar: "الملخص التنفيذي" },
          },
          {
            type: "html",
            name: "summary",
            html: "<p>Provide a brief overview of the report's findings and conclusions.</p>",
          },
          { type: "divider", name: "sep2" },
          {
            type: "heading",
            name: "detailsTitle",
            title: { default: "Details", ar: "التفاصيل" },
          },
          {
            type: "html",
            name: "details",
            html: "<p>Add the detailed content of your report here.</p>",
          },
        ],
      }],
    }),
  },

  {
    id: "pdf-invoice",
    labelKey: "pdfInvoice",
    descriptionKey: "pdfInvoiceDesc",
    mode: "pdf",
    build: (t) => ({
      title: tx(t, "designer.templates.pdfInvoice"),
      pages: [{
        name: "page1",
        elements: [
          {
            type: "heading",
            name: "title",
            title: { default: "Invoice", ar: "فاتورة" },
          },
          {
            type: "dynamictext",
            name: "meta",
            text: { default: "Invoice No: {invoice_number}  |  Date: {date}  |  Due: {due_date}", ar: "رقم الفاتورة: {invoice_number}  |  التاريخ: {date}  |  الاستحقاق: {due_date}" },
          },
          { type: "divider", name: "sep1" },
          {
            type: "dynamictext",
            name: "billTo",
            text: { default: "Bill To: {client_name}\n{client_address}", ar: "إلى: {client_name}\n{client_address}" },
          },
          { type: "divider", name: "sep2" },
          {
            type: "html",
            name: "items",
            html: "<table style='width:100%;border-collapse:collapse'><thead><tr style='background:#f3f4f6'><th style='padding:8px;text-align:left;border:1px solid #e5e7eb'>Description</th><th style='padding:8px;text-align:right;border:1px solid #e5e7eb'>Qty</th><th style='padding:8px;text-align:right;border:1px solid #e5e7eb'>Unit Price</th><th style='padding:8px;text-align:right;border:1px solid #e5e7eb'>Total</th></tr></thead><tbody><tr><td style='padding:8px;border:1px solid #e5e7eb'>Item description</td><td style='padding:8px;text-align:right;border:1px solid #e5e7eb'>1</td><td style='padding:8px;text-align:right;border:1px solid #e5e7eb'>$0.00</td><td style='padding:8px;text-align:right;border:1px solid #e5e7eb'>$0.00</td></tr></tbody></table>",
          },
          { type: "divider", name: "sep3" },
          {
            type: "dynamictext",
            name: "total",
            text: { default: "Total Due: {total_amount}", ar: "الإجمالي المستحق: {total_amount}" },
          },
        ],
      }],
    }),
  },
];
