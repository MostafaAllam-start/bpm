// The field-type registry: the single source of truth for every supported
// field. Each entry carries its palette metadata (label, icon, group), the list
// of properties the property panel may edit, sensible defaults, and a `Render`
// that draws the *control* in the runtime. Add a field type by adding one entry
// here (and a member to `FieldType` in types.ts).

import type { ReactNode } from "react";
import type { FieldType, FormField } from "../types";
import type { VariableRef } from "@shared/variables.ts";
import { resolveText } from "./text";
import { interpolate } from "./interpolation";
import SignatureControl, {
  SignaturePreset,
  SignatureActorPlaceholder,
} from "../fields/SignatureField";
import { CheckboxField, DropdownField, RadioField } from "../fields/ChoiceFields";
import { ImageUploadField, FileUploadField } from "../fields/UploadFields";
import { TableField } from "../fields/TableField";
import {
  OrderedListField,
  UnorderedListField,
  renderWithRuntimeChips,
} from "../fields/ListFields";

// Which curated editors the property panel shows for a field type.
export type EditableProp =
  | "title"
  | "name"
  | "description"
  | "isRequired"
  | "placeholder"
  | "inputType"
  | "choices"
  | "rateMax"
  | "html"
  | "dynamicText"
  | "src"
  | "imageSource"
  | "alt"
  | "height"
  | "signatureDisplay"
  | "optionsMaxHeight"
  | "collapsible"
  | "table"
  | "accept"
  | "listTitle"
  | "listItems"
  | "listStyle"
  | "listMaxHeight"
  | "listStyleColor"
  | "listTextColor"
  | "listFontWeight"
  | "listFontSize"
  | "listFontFamily"
  | "listTitleColor"
  | "listTitleFontWeight"
  | "listTitleFontSize"
  | "listTitleFontFamily";

export type FieldRenderProps = {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  locale: string;
  id: string;
  disabled?: boolean;
  // The variable scope for `{name}` interpolation in display text: the form's
  // own answers merged with any in-scope process / upstream-form variables.
  // Supplied by the runtime renderer; absent in the designer canvas preview (so
  // tokens stay visible as bindings there).
  scope?: Record<string, unknown>;
  // Available variables for the designer canvas — when scope is absent, dynamic
  // text renders each `{token}` as a labelled chip instead of raw `{token}`.
  variables?: VariableRef[];
};

export type FieldTypeDef = {
  type: FieldType;
  labelKey: string; // i18n key under "designer.types"
  group: "input" | "choice" | "display";
  icon: ReactNode;
  editableProps: EditableProp[];
  defaultProps: () => Partial<FormField>;
  Render: (props: FieldRenderProps) => ReactNode;
};

// ── Icons (small inline SVGs, currentColor) ───────────────────────────────
const icon = (path: ReactNode): ReactNode => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);
const ICONS = {
  text: icon(<><path d="M4 7h16" /><path d="M4 12h10" /></>),
  email: icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  number: icon(<><path d="M5 8h14M5 16h14M10 4l-2 16M16 4l-2 16" /></>),
  date: icon(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>),
  comment: icon(<><path d="M4 5h16v11H9l-5 4z" /></>),
  dropdown: icon(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="m8 11 4 3 4-3" /></>),
  radio: icon(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" /></>),
  checkbox: icon(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 3 3 5-6" /></>),
  boolean: icon(<><rect x="2" y="7" width="20" height="10" rx="5" /><circle cx="16" cy="12" r="3" fill="currentColor" /></>),
  rating: icon(<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z" />),
  signature: icon(<><path d="M3 17c3 0 4-9 6-9s2 6 4 6 2-3 4-3 2 2 3 2" /><path d="M3 20h18" /></>),
  signatureupload: icon(<><path d="M2 13c2 0 3-7 4.5-7S8 11 9.5 11 11 9 12 9" /><path d="M2 17h9" /><path d="M18 21v-7M15.5 16.5 18 14l2.5 2.5" /></>),
  datetime: icon(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /><path d="M12 13v2.5l1.6 1" /></>),
  image: icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>),
  iframe: icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 8h18" /><circle cx="6" cy="6" r="0.6" fill="currentColor" /></>),
  imageupload: icon(<><rect x="3" y="5" width="13" height="13" rx="2" /><circle cx="7.5" cy="9.5" r="1.4" /><path d="m3 16 4-3.5 3 2.5" /><path d="M19 13.5V7.5M16.7 9.8 19 7.5l2.3 2.3" /></>),
  fileupload: icon(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M12 18.5v-5M9.7 15.8 12 13.5l2.3 2.3" /></>),
  html: icon(<><path d="m8 9-3 3 3 3M16 9l3 3-3 3M13 7l-2 10" /></>),
  dynamictext: icon(<><path d="M5 7h9M9 7v10M7 7H5M11 7h2" /><path d="M16 8c1.5 0 1.5 1.5 1.5 2v4c0 .5 0 2 1.5 2M22 8c-1.5 0-1.5 1.5-1.5 2v4c0 .5 0 2-1.5 2" /></>),
  group: icon(<><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18" /><path d="M6.5 13h7" /></>),
  table: icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14.5h18M9 9v11M15 9v11" /></>),
  orderedlist: icon(<><path d="M11 6h10M11 12h10M11 18h10" /><path d="M5.5 4.5v3" /><path d="M4 10.5h3l-3 3h3" /><path d="M4 16.5h2.5v1.5h-2v1.5h2.5" /></>),
  unorderedlist: icon(<><path d="M11 6h10M11 12h10M11 18h10" /><circle cx="5" cy="6" r="1.3" fill="currentColor" /><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="5" cy="18" r="1.3" fill="currentColor" /></>),
};

// ── Embed helpers ─────────────────────────────────────────────────────────
// Many video hosts forbid embedding their normal pages in an <iframe> via
// X-Frame-Options (e.g. youtube.com/watch and the youtube.com homepage). They
// only allow their dedicated /embed/ player URLs. Translate the common
// share/watch URLs into their embeddable equivalents so designers can paste a
// regular link and have it just work.
function toEmbedUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");

    // YouTube: watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      const m = url.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    // Vimeo: vimeo.com/ID -> player.vimeo.com/video/ID
    if (host === "vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    // Not a parseable absolute URL — leave it untouched.
  }
  return raw;
}

// Parse a template string and return an array of text nodes interleaved with
// chip elements for each recognised `{token}`. Used in the canvas preview so
// the author sees the same badge style as in the property-panel mention input.
function renderWithVariableChips(
  template: string,
  variables: VariableRef[],
): ReactNode[] {
  const parts: ReactNode[] = [];
  const TOKEN = /\{([A-Za-z0-9_.-]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push(template.slice(lastIndex, match.index));
    }
    const tokenRef = match[1];
    const variable = variables.find((v) => (v.ref ?? v.name) === tokenRef);
    if (variable) {
      const label = variable.source
        ? `${variable.source}.${variable.name}`
        : variable.name;
      parts.push(
        <span key={match.index} className="dz-mention-chip">
          {label}
        </span>,
      );
    } else {
      parts.push(match[0]);
    }
    lastIndex = TOKEN.lastIndex;
  }
  if (lastIndex < template.length) {
    parts.push(template.slice(lastIndex));
  }
  return parts;
}

// ── Control renderers ─────────────────────────────────────────────────────
function TextControl(p: FieldRenderProps, type: string) {
  return (
    <input
      id={p.id}
      className="ff-input"
      type={type}
      disabled={p.disabled}
      placeholder={resolveText(p.field.placeholder, p.locale)}
      value={(p.value as string) ?? ""}
      onChange={(e) => p.onChange(e.target.value)}
    />
  );
}

export const FIELD_TYPES: FieldTypeDef[] = [
  {
    type: "text",
    labelKey: "text",
    group: "input",
    icon: ICONS.text,
    editableProps: ["title", "name", "description", "isRequired", "placeholder", "inputType"],
    defaultProps: () => ({ title: { default: "Single line", ar: "سطر واحد" } }),
    Render: (p) => TextControl(p, p.field.inputType || "text"),
  },
  {
    type: "email",
    labelKey: "email",
    group: "input",
    icon: ICONS.email,
    editableProps: ["title", "name", "description", "isRequired", "placeholder"],
    defaultProps: () => ({ title: { default: "Email", ar: "بريد إلكتروني" } }),
    Render: (p) => TextControl(p, "email"),
  },
  {
    type: "number",
    labelKey: "number",
    group: "input",
    icon: ICONS.number,
    editableProps: ["title", "name", "description", "isRequired", "placeholder"],
    defaultProps: () => ({ title: { default: "Number", ar: "رقم" } }),
    Render: (p) => TextControl(p, "number"),
  },
  {
    type: "date",
    labelKey: "date",
    group: "input",
    icon: ICONS.date,
    editableProps: ["title", "name", "description", "isRequired"],
    defaultProps: () => ({ title: { default: "Date", ar: "تاريخ" } }),
    Render: (p) => TextControl(p, "date"),
  },
  {
    type: "datetime",
    labelKey: "datetime",
    group: "input",
    icon: ICONS.datetime,
    editableProps: ["title", "name", "description", "isRequired"],
    defaultProps: () => ({ title: { default: "Date & time", ar: "تاريخ ووقت" } }),
    Render: (p) => TextControl(p, "datetime-local"),
  },
  {
    type: "comment",
    labelKey: "comment",
    group: "input",
    icon: ICONS.comment,
    editableProps: ["title", "name", "description", "isRequired", "placeholder"],
    defaultProps: () => ({ title: { default: "Long text", ar: "نص طويل" } }),
    Render: (p) => (
      <textarea
        id={p.id}
        className="ff-input ff-textarea"
        rows={4}
        disabled={p.disabled}
        placeholder={resolveText(p.field.placeholder, p.locale)}
        value={(p.value as string) ?? ""}
        onChange={(e) => p.onChange(e.target.value)}
      />
    ),
  },
  {
    type: "dropdown",
    labelKey: "dropdown",
    group: "choice",
    icon: ICONS.dropdown,
    editableProps: ["title", "name", "description", "isRequired", "placeholder", "choices"],
    defaultProps: () => ({ title: { default: "Dropdown", ar: "قائمة منسدلة" }, choices: defaultChoices() }),
    Render: (p) => <DropdownField {...p} />,
  },
  {
    type: "radiogroup",
    labelKey: "radiogroup",
    group: "choice",
    icon: ICONS.radio,
    editableProps: ["title", "name", "description", "isRequired", "choices"],
    defaultProps: () => ({ title: { default: "Radio group", ar: "أزرار اختيار" }, choices: defaultChoices() }),
    Render: (p) => <RadioField {...p} />,
  },
  {
    type: "checkbox",
    labelKey: "checkbox",
    group: "choice",
    icon: ICONS.checkbox,
    editableProps: [
      "title",
      "name",
      "description",
      "isRequired",
      "choices",
      "optionsMaxHeight",
    ],
    defaultProps: () => ({ title: { default: "Checkboxes", ar: "مربعات اختيار" }, choices: defaultChoices() }),
    Render: (p) => <CheckboxField {...p} />,
  },
  {
    type: "boolean",
    labelKey: "boolean",
    group: "choice",
    icon: ICONS.boolean,
    editableProps: ["title", "name", "description", "isRequired"],
    defaultProps: () => ({ title: { default: "Yes / No", ar: "نعم / لا" } }),
    Render: (p) => (
      <label className="ff-switch">
        <input
          type="checkbox"
          disabled={p.disabled}
          checked={Boolean(p.value)}
          onChange={(e) => p.onChange(e.target.checked)}
        />
        <span className="ff-switch-track" aria-hidden="true">
          <span className="ff-switch-thumb" />
        </span>
      </label>
    ),
  },
  {
    type: "rating",
    labelKey: "rating",
    group: "input",
    icon: ICONS.rating,
    editableProps: ["title", "name", "description", "isRequired", "rateMax"],
    defaultProps: () => ({ title: { default: "Rating", ar: "تقييم" }, rateMax: 5 }),
    Render: (p) => {
      const max = p.field.rateMax ?? 5;
      const current = Number(p.value) || 0;
      return (
        <div className="ff-rating">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`ff-star${n <= current ? " is-on" : ""}`}
              disabled={p.disabled}
              aria-label={String(n)}
              onClick={() => p.onChange(n === current ? 0 : n)}
            >
              ★
            </button>
          ))}
        </div>
      );
    },
  },
  {
    type: "signature",
    labelKey: "signature",
    group: "display",
    icon: ICONS.signature,
    editableProps: ["signatureDisplay"],
    defaultProps: () => ({ signatureSource: "preset" }),
    Render: (p) =>
      p.field.signatureSource === "currentActor" ? (
        <SignatureActorPlaceholder />
      ) : (
        <SignaturePreset {...p} />
      ),
  },
  {
    type: "signatureupload",
    labelKey: "signatureupload",
    group: "input",
    icon: ICONS.signatureupload,
    editableProps: ["title", "name", "description", "isRequired"],
    defaultProps: () => ({ title: { default: "Signature upload", ar: "رفع توقيع" } }),
    Render: (p) => <SignatureControl {...p} />,
  },
  {
    type: "imageupload",
    labelKey: "imageupload",
    group: "input",
    icon: ICONS.imageupload,
    editableProps: ["title", "name", "description", "isRequired"],
    defaultProps: () => ({ title: { default: "Image upload", ar: "رفع صورة" } }),
    Render: (p) => <ImageUploadField {...p} />,
  },
  {
    type: "fileupload",
    labelKey: "fileupload",
    group: "input",
    icon: ICONS.fileupload,
    editableProps: ["title", "name", "description", "isRequired", "accept"],
    defaultProps: () => ({ title: { default: "File upload", ar: "رفع ملف" } }),
    Render: (p) => <FileUploadField {...p} />,
  },
  {
    type: "image",
    labelKey: "image",
    group: "display",
    icon: ICONS.image,
    editableProps: ["imageSource", "alt"],
    defaultProps: () => ({ src: "" }),
    Render: (p) => {
      // The URL may embed `{variable}` tokens (e.g. a per-user image path), so
      // it's interpolated against the runtime scope; with no scope (the designer
      // canvas) the tokens stay literal.
      const src = interpolate(p.field.src ?? "", p.scope).trim();
      if (!src) return <div className="ff-embed-empty">{p.field.type}</div>;
      // No explicit width/height: the image fits its field box (object-fit keeps
      // its aspect ratio), set by the .ff-image rules.
      return (
        <img
          className="ff-image"
          src={src}
          alt={interpolate(resolveText(p.field.alt, p.locale), p.scope)}
        />
      );
    },
  },
  {
    type: "iframe",
    labelKey: "iframe",
    group: "display",
    icon: ICONS.iframe,
    editableProps: ["src", "height"],
    defaultProps: () => ({ src: "", height: 320 }),
    Render: (p) => {
      // The URL may embed `{variable}` tokens, resolved against the runtime scope.
      const src = interpolate(p.field.src ?? "", p.scope).trim();
      if (!src) return <div className="ff-embed-empty">{p.field.type}</div>;
      return (
        <iframe
          className="ff-iframe"
          src={toEmbedUrl(src)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={p.id}
          style={{ height: p.field.height ?? 320 }}
        />
      );
    },
  },
  {
    type: "group",
    labelKey: "group",
    group: "display",
    icon: ICONS.group,
    editableProps: ["title", "name", "collapsible"],
    defaultProps: () => ({ title: { default: "Section", ar: "قسم" }, collapsible: false }),
    Render: (p) => {
      // An empty title hides the header entirely — unless the section is
      // collapsible, which still needs the header for its toggle. The title may
      // embed `{variable}` tokens, resolved against the runtime scope.
      const title = interpolate(resolveText(p.field.title, p.locale), p.scope);
      const showHead = title.trim() !== "" || Boolean(p.field.collapsible);
      return (
        <div className={`ff-group${p.field.collapsible ? " is-collapsible" : ""}`}>
          {showHead && (
            <div className="ff-group-head">
              {p.field.collapsible && (
                <span className="ff-group-caret" aria-hidden="true">
                  ▾
                </span>
              )}
              {title && <span className="ff-group-title">{title}</span>}
            </div>
          )}
        </div>
      );
    },
  },
  {
    type: "table",
    labelKey: "table",
    group: "display",
    icon: ICONS.table,
    editableProps: ["table"],
    defaultProps: () => ({
      tableSource: "manual",
      tableColumns: [{ default: "Column 1", ar: "عمود 1" }, { default: "Column 2", ar: "عمود 2" }],
      tableRows: [
        [{ default: "" }, { default: "" }],
        [{ default: "" }, { default: "" }],
      ],
      tableHeader: true,
    }),
    Render: (p) => <TableField {...p} />,
  },
  {
    type: "dynamictext",
    labelKey: "dynamictext",
    group: "display",
    icon: ICONS.dynamictext,
    editableProps: ["dynamicText"],
    defaultProps: () => ({ text: { default: "Text with a {variable}", ar: "نص مع {variable}" } }),
    Render: (p) => {
      const template = resolveText(p.field.text, p.locale);
      let content: ReactNode;
      if (p.scope !== undefined) {
        // Runtime/preview: resolved tokens become their value; unresolved ones
        // show as @-chip badges so the author can see which bindings are missing.
        const nodes = renderWithRuntimeChips(template, p.scope);
        content = nodes.length ? <>{nodes}</> : null;
      } else if (p.variables?.length && template) {
        // Designer canvas with variables: render each `{token}` as a chip badge.
        const chips = renderWithVariableChips(template, p.variables);
        content = chips.length ? <>{chips}</> : null;
      } else {
        // Designer canvas without variables: show raw template text.
        content = template || null;
      }
      return (
        <div className="ff-dynamic-text" dir="auto">
          {content ?? <span className="ff-dynamic-text-empty">{p.field.type}</span>}
        </div>
      );
    },
  },
  {
    type: "html",
    labelKey: "html",
    group: "display",
    icon: ICONS.html,
    editableProps: ["html"],
    defaultProps: () => ({ html: "<p>Information text</p>" }),
    Render: (p) => (
      <div
        className="ff-html"
        // Author-controlled content from the form designer. `{variable}` tokens
        // are resolved against the runtime scope (literal in the designer canvas).
        dangerouslySetInnerHTML={{
          __html: interpolate(resolveText(p.field.html, p.locale), p.scope),
        }}
      />
    ),
  },
  {
    type: "orderedlist",
    labelKey: "orderedlist",
    group: "display",
    icon: ICONS.orderedlist,
    editableProps: [
      "listTitle",
      "listItems",
      "listMaxHeight",
      "listStyleColor",
      "listTextColor",
      "listFontWeight",
      "listFontSize",
      "listFontFamily",
      "listTitleColor",
      "listTitleFontWeight",
      "listTitleFontSize",
      "listTitleFontFamily",
    ],
    defaultProps: () => ({
      listTitle: { default: "Ordered List", ar: "قائمة مرتبة" },
      listItems: [
        { default: "Item 1", ar: "عنصر 1" },
        { default: "Item 2", ar: "عنصر 2" },
        { default: "Item 3", ar: "عنصر 3" },
      ],
    }),
    Render: (p) => <OrderedListField {...p} />,
  },
  {
    type: "unorderedlist",
    labelKey: "unorderedlist",
    group: "display",
    icon: ICONS.unorderedlist,
    editableProps: [
      "listTitle",
      "listItems",
      "listStyle",
      "listMaxHeight",
      "listStyleColor",
      "listTextColor",
      "listFontWeight",
      "listFontSize",
      "listFontFamily",
      "listTitleColor",
      "listTitleFontWeight",
      "listTitleFontSize",
      "listTitleFontFamily",
    ],
    defaultProps: () => ({
      listTitle: { default: "Unordered List", ar: "قائمة غير مرتبة" },
      listItems: [
        { default: "Item 1", ar: "عنصر 1" },
        { default: "Item 2", ar: "عنصر 2" },
        { default: "Item 3", ar: "عنصر 3" },
      ],
      listStyle: "disc",
    }),
    Render: (p) => <UnorderedListField {...p} />,
  },
];

function defaultChoices() {
  return [
    { value: "item1", text: { default: "Option 1", ar: "خيار 1" } },
    { value: "item2", text: { default: "Option 2", ar: "خيار 2" } },
    { value: "item3", text: { default: "Option 3", ar: "خيار 3" } },
  ];
}

const BY_TYPE = new Map<FieldType, FieldTypeDef>(
  FIELD_TYPES.map((def) => [def.type, def]),
);

export function getFieldType(type: FieldType): FieldTypeDef | undefined {
  return BY_TYPE.get(type);
}
