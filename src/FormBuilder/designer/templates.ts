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

  // ── Approval Form (submittable) ────────────────────────────────────────
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
];
