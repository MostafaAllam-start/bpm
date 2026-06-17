// The field-type registry: the single source of truth for every supported
// field. Each entry carries its palette metadata (label, icon, group), the list
// of properties the property panel may edit, sensible defaults, and a `Render`
// that draws the *control* in the runtime. Add a field type by adding one entry
// here (and a member to `FieldType` in types.ts).

import type { ReactNode } from "react";
import type { FieldType, FormField } from "./types";
import { resolveText } from "./text";
import SignatureControl, {
  SignaturePreset,
  SignatureActorPlaceholder,
} from "./fields/SignatureField";
import { CheckboxField, DropdownField, RadioField } from "./fields/ChoiceFields";
import { ImageUploadField, FileUploadField } from "./fields/UploadFields";

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
  | "src"
  | "alt"
  | "height"
  | "signatureDisplay"
  | "previewSize"
  | "optionsMaxHeight"
  | "accept";

export type FieldRenderProps = {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  locale: string;
  id: string;
  disabled?: boolean;
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
    defaultProps: () => ({}),
    Render: (p) => TextControl(p, p.field.inputType || "text"),
  },
  {
    type: "email",
    labelKey: "email",
    group: "input",
    icon: ICONS.email,
    editableProps: ["title", "name", "description", "isRequired", "placeholder"],
    defaultProps: () => ({}),
    Render: (p) => TextControl(p, "email"),
  },
  {
    type: "number",
    labelKey: "number",
    group: "input",
    icon: ICONS.number,
    editableProps: ["title", "name", "description", "isRequired", "placeholder"],
    defaultProps: () => ({}),
    Render: (p) => TextControl(p, "number"),
  },
  {
    type: "date",
    labelKey: "date",
    group: "input",
    icon: ICONS.date,
    editableProps: ["title", "name", "description", "isRequired"],
    defaultProps: () => ({}),
    Render: (p) => TextControl(p, "date"),
  },
  {
    type: "datetime",
    labelKey: "datetime",
    group: "input",
    icon: ICONS.datetime,
    editableProps: ["title", "name", "description", "isRequired"],
    defaultProps: () => ({}),
    Render: (p) => TextControl(p, "datetime-local"),
  },
  {
    type: "comment",
    labelKey: "comment",
    group: "input",
    icon: ICONS.comment,
    editableProps: ["title", "name", "description", "isRequired", "placeholder"],
    defaultProps: () => ({}),
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
    defaultProps: () => ({ choices: defaultChoices() }),
    Render: (p) => <DropdownField {...p} />,
  },
  {
    type: "radiogroup",
    labelKey: "radiogroup",
    group: "choice",
    icon: ICONS.radio,
    editableProps: ["title", "name", "description", "isRequired", "choices"],
    defaultProps: () => ({ choices: defaultChoices() }),
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
    defaultProps: () => ({ choices: defaultChoices() }),
    Render: (p) => <CheckboxField {...p} />,
  },
  {
    type: "boolean",
    labelKey: "boolean",
    group: "choice",
    icon: ICONS.boolean,
    editableProps: ["title", "name", "description", "isRequired"],
    defaultProps: () => ({}),
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
    defaultProps: () => ({ rateMax: 5 }),
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
    editableProps: ["signatureDisplay", "previewSize"],
    defaultProps: () => ({ signatureSource: "preset" }),
    Render: (p) =>
      p.field.signatureSource === "currentActor" ? (
        <SignatureActorPlaceholder {...p} />
      ) : (
        <SignaturePreset {...p} />
      ),
  },
  {
    type: "signatureupload",
    labelKey: "signatureupload",
    group: "input",
    icon: ICONS.signatureupload,
    editableProps: ["title", "name", "description", "isRequired", "previewSize"],
    defaultProps: () => ({}),
    Render: (p) => <SignatureControl {...p} />,
  },
  {
    type: "imageupload",
    labelKey: "imageupload",
    group: "input",
    icon: ICONS.imageupload,
    editableProps: ["title", "name", "description", "isRequired"],
    defaultProps: () => ({}),
    Render: (p) => <ImageUploadField {...p} />,
  },
  {
    type: "fileupload",
    labelKey: "fileupload",
    group: "input",
    icon: ICONS.fileupload,
    editableProps: ["title", "name", "description", "isRequired", "accept"],
    defaultProps: () => ({}),
    Render: (p) => <FileUploadField {...p} />,
  },
  {
    type: "image",
    labelKey: "image",
    group: "display",
    icon: ICONS.image,
    editableProps: ["src", "alt", "height"],
    defaultProps: () => ({ src: "" }),
    Render: (p) => {
      const src = p.field.src?.trim();
      if (!src) return <div className="ff-embed-empty">{p.field.type}</div>;
      return (
        <img
          className="ff-image"
          src={src}
          alt={resolveText(p.field.alt, p.locale)}
          style={p.field.height ? { height: p.field.height } : undefined}
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
      const src = p.field.src?.trim();
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
    type: "html",
    labelKey: "html",
    group: "display",
    icon: ICONS.html,
    editableProps: ["html"],
    defaultProps: () => ({ html: "<p>Information text</p>" }),
    Render: (p) => (
      <div
        className="ff-html"
        // Author-controlled content from the form designer.
        dangerouslySetInnerHTML={{ __html: resolveText(p.field.html, p.locale) }}
      />
    ),
  },
];

function defaultChoices() {
  return [
    { value: "item1", text: { default: "Option 1" } },
    { value: "item2", text: { default: "Option 2" } },
    { value: "item3", text: { default: "Option 3" } },
  ];
}

const BY_TYPE = new Map<FieldType, FieldTypeDef>(
  FIELD_TYPES.map((def) => [def.type, def]),
);

export function getFieldType(type: FieldType): FieldTypeDef | undefined {
  return BY_TYPE.get(type);
}
