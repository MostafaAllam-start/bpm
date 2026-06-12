import i18n from "./index";

// `@bpmn-io/form-js-editor` doesn't route its chrome through a single
// `translate` service the way bpmn-js does: the components palette hardcodes
// its strings in the DOM, and the properties panel receives literal English
// group/field labels. So we translate the rendered chrome in place — scoped to
// the palette and properties containers so the form *preview* (user content) is
// never touched — and keep it in sync as the panel re-renders or the language
// changes. Mirrors BpmnModeler/i18n/tokenSimulationI18n.ts.
//
// Maps the English source strings to Arabic; anything not listed falls back to
// the original English.
const ar: Record<string, string> = {
  // Palette — chrome
  Components: "المكوّنات",
  "Search components": "البحث في المكوّنات",
  "Clear content": "مسح المحتوى",
  "No components found.": "لا توجد مكوّنات.",

  // Palette — group titles
  Input: "الإدخال",
  Selection: "الاختيار",
  Presentation: "العرض",
  Containers: "الحاويات",
  Action: "الإجراء",

  // Field type labels (shown in the palette and as the properties-panel header)
  "Text field": "حقل نصي",
  "Text area": "منطقة نص",
  Number: "رقم",
  "Date time": "التاريخ والوقت",
  Checkbox: "خانة اختيار",
  "Checkbox group": "مجموعة خانات اختيار",
  "Radio group": "مجموعة أزرار اختيار",
  Select: "قائمة منسدلة",
  "Tag list": "قائمة وسوم",
  "File picker": "منتقي الملفات",
  Expression: "تعبير",
  "Text view": "عرض نص",
  "HTML view": "عرض HTML",
  "Image view": "عرض صورة",
  Table: "جدول",
  Spacer: "فاصل مسافة",
  Separator: "فاصل",
  Group: "مجموعة",
  "Dynamic list": "قائمة ديناميكية",
  iFrame: "إطار iFrame",
  Button: "زر",
  "Document preview": "معاينة مستند",

  // Properties panel — group headers
  General: "عام",
  Serialization: "التسلسل",
  Constraints: "القيود",
  Condition: "الشرط",
  Layout: "التخطيط",
  Appearance: "المظهر",
  Validation: "التحقق",
  "Custom properties": "خصائص مخصّصة",
  "Security attributes": "سمات الأمان",

  // Properties panel — entry labels
  "Field label": "تسمية الحقل",
  "Field description": "وصف الحقل",
  Key: "المفتاح",
  Path: "المسار",
  "Default value": "القيمة الافتراضية",
  "Group label": "تسمية المجموعة",
  Label: "التسمية",
  Value: "القيمة",
  Text: "النص",
  Title: "العنوان",
  Type: "النوع",
  "Show outline": "إظهار الإطار",
  "Vertical alignment": "المحاذاة العمودية",
  "Read only": "للقراءة فقط",
  Disabled: "معطّل",
  Required: "مطلوب",
  Searchable: "قابل للبحث",
  "Alternative text": "نص بديل",
  Columns: "الأعمدة",
  Height: "الارتفاع",
  URL: "الرابط",
  "Date label": "تسمية التاريخ",
  "Time label": "تسمية الوقت",
  "Use 24h": "استخدام نظام 24 ساعة",
  "Time interval": "الفاصل الزمني",
  "Decimal digits": "الأرقام العشرية",
  Increment: "الزيادة",
  Prefix: "بادئة",
  Suffix: "لاحقة",
  "Options source": "مصدر الخيارات",
  "Static options": "خيارات ثابتة",
  "Minimum length": "الحد الأدنى للطول",
  "Maximum length": "الحد الأقصى للطول",
  "Custom regular expression": "تعبير نمطي مخصّص",
  "Custom error message": "رسالة خطأ مخصّصة",
  "Validation pattern": "نمط التحقق",
  Minimum: "الحد الأدنى",
  Maximum: "الحد الأقصى",
  ID: "المعرّف",
  Content: "المحتوى",
  "Image source": "مصدر الصورة",
  "Target value": "القيمة المستهدفة",
  "Compute on": "الحساب عند",
  "Output as string": "الإخراج كنص",
  Subtype: "النوع الفرعي",
  "Disallow past dates": "منع التواريخ السابقة",
  "Time format": "تنسيق الوقت",
  "Input values key": "مفتاح قيم الإدخال",
  "Default number of items": "عدد العناصر الافتراضي",
  "Allow add/delete items": "السماح بإضافة/حذف العناصر",
  "Disable collapse": "تعطيل الطي",
  "Number of non-collapsing items": "عدد العناصر غير القابلة للطي",
  "Options expression": "تعبير الخيارات",
  "Dynamic options": "خيارات ديناميكية",
  "Data source": "مصدر البيانات",
  Pagination: "ترقيم الصفحات",
  "Number of rows per page": "عدد الصفوف في الصفحة",
  "List of items": "قائمة العناصر",
  Column: "العمود",
  "Version tag": "وسم الإصدار",
  "Supported file formats": "صيغ الملفات المدعومة",
  "Upload multiple files": "رفع ملفات متعددة",
  "Document reference": "مرجع المستند",
  "Max height of preview container": "أقصى ارتفاع لحاوية المعاينة",
  "Headers source": "مصدر الترويسات",
  "Header items": "عناصر الترويسة",
  "Hide if": "إخفاء إذا",
  "Deactivate if": "تعطيل إذا",
  // Default field labels that form-js assigns to a freshly dropped field.
  Date: "التاريخ",
  Time: "الوقت",
  // Date/time field "Subtype" and time-serialization options.
  "Date & Time": "التاريخ والوقت",
  "UTC offset": "إزاحة UTC",
  "UTC normalized": "موحّد بتوقيت UTC",
  "No timezone": "بدون منطقة زمنية",

  // Number field — settings validation messages.
  "A number is required.": "يجب إدخال رقم.",
  "Should be an integer.": "يجب أن يكون عدداً صحيحاً.",
  "Should be greater than zero.": "يجب أن يكون أكبر من صفر.",

  // iFrame field — "Security attributes" group (sandbox/allow directives).
  "These options can incur security risks, especially if used in combination with dynamic links. Ensure that you are aware of them, that you trust the source url and only enable what your use case requires.":
    "قد تؤدي هذه الخيارات إلى مخاطر أمنية، خاصةً عند استخدامها مع الروابط الديناميكية. تأكّد من إدراكك لها، ومن ثقتك في رابط المصدر، ولا تُفعّل سوى ما تتطلبه حالة استخدامك.",
  "Script execution": "تنفيذ البرامج النصية",
  "Allow same origin": "السماح بنفس المصدر",
  "Open in fullscreen": "الفتح في وضع ملء الشاشة",
  Geolocation: "تحديد الموقع الجغرافي",
  "Camera access": "الوصول إلى الكاميرا",
  "Microphone access": "الوصول إلى الميكروفون",
  "Forms submission": "إرسال النماذج",
  "Open modal windows": "فتح النوافذ الحوارية المنبثقة",
  "Open popups": "فتح النوافذ المنبثقة",
  "Top level navigation": "التنقّل على المستوى الأعلى",
  "Storage access by user": "وصول المستخدم إلى التخزين",

  // Properties panel — select option values
  Submit: "إرسال",
  Reset: "إعادة تعيين",
  Auto: "تلقائي",
  Checked: "محدّد",
  "Not checked": "غير محدّد",
  "<none>": "<لا شيء>",
  Top: "أعلى",
  Center: "وسط",
  Bottom: "أسفل",
  "Value changes": "تغيّر القيمة",
  "Form submission": "إرسال النموذج",
  Custom: "مخصّص",
  Email: "البريد الإلكتروني",
  Phone: "الهاتف",

  // Properties panel — field descriptions (helper text under an entry)
  "Binds to a form variable": "يرتبط بمتغيّر في النموذج",
  "Condition under which the field is hidden":
    "الشرط الذي يُخفى الحقل بناءً عليه",
  "Condition under which the field is deactivated":
    "الشرط الذي يُعطَّل الحقل بناءً عليه",
  "Where the child variables of this component are pathed to.":
    "المسار الذي تُوجَّه إليه المتغيّرات الفرعية لهذا المكوّن.",
  "Height of the container in pixels.": "ارتفاع الحاوية بالبكسل.",
  "Expression or static value (link/data URI)":
    "تعبير أو قيمة ثابتة (رابط/معرّف بيانات URI)",
  "Define an expression to calculate the value of this field":
    "حدّد تعبيراً لحساب قيمة هذا الحقل",
  "Allows arbitrary precision values": "يسمح بقيم ذات دقة اعتباطية",
  "Define which input property to populate the values from":
    "حدّد خاصية الإدخال التي تُملأ القيم منها",
  "Define an expression to populate the options from.":
    "حدّد تعبيراً لملء الخيارات منه.",
  "Specify the source from which to populate the table":
    "حدّد المصدر الذي يُملأ منه الجدول",
  "Specify an expression to populate column items":
    "حدّد تعبيراً لملء عناصر الأعمدة",

  // Properties panel — tooltips (the "?" hints next to a field)
  "Descriptive text for screen reader accessibility.":
    "نص وصفي لإتاحة الوصول عبر قارئات الشاشة.",
  "Disable this field when it should not be interactive for end-users. Its data will not be submitted. This setting takes precedence over read-only.":
    "عطّل هذا الحقل عندما لا ينبغي أن يكون تفاعلياً للمستخدمين النهائيين. لن تُرسَل بياناته. ولهذا الإعداد الأولوية على «للقراءة فقط».",
  'Use a unique "key" to link the form element and the related input/output data. When dealing with nested data, break it down in the user task\'s input mapping before using it.':
    "استخدم «مفتاحاً» فريداً لربط عنصر النموذج ببيانات الإدخال/الإخراج المرتبطة به. وعند التعامل مع بيانات متداخلة، فكّكها في تعيين إدخال مهمة المستخدم قبل استخدامها.",
  "Link referring to a hosted image, or use a data URI directly to embed image data into the form.":
    "رابط يشير إلى صورة مستضافة، أو استخدم معرّف بيانات URI مباشرةً لتضمين بيانات الصورة في النموذج.",
  "Make this field read-only when it cannot be edited by the end-user, but its content is important for them to see. Its data will still be submitted.":
    "اجعل هذا الحقل للقراءة فقط عندما لا يمكن للمستخدم النهائي تعديله، لكن محتواه مهم لاطّلاعه عليه. وستظل بياناته تُرسَل.",
  "Enter a form input variable that contains the data for the table or define an expression to populate the data dynamically.":
    "أدخل متغيّر إدخال للنموذج يحتوي على بيانات الجدول، أو حدّد تعبيراً لملء البيانات ديناميكياً.",
  "The error message to display when the input does not match the regular expression.":
    "رسالة الخطأ التي تظهر عندما لا يطابق الإدخال التعبير النمطي.",
  "Add properties directly to the form schema, useful to configure functionality in custom-built task applications and form renderers.":
    "أضف خصائص مباشرةً إلى مخطّط النموذج، وهو مفيد لضبط الوظائف في تطبيقات المهام ومُصيّرات النماذج المُخصّصة.",

  // Properties panel — list-item / section controls and empty states
  "<empty>": "<فارغ>",
  "Toggle list item": "تبديل عنصر القائمة",
  "Delete item": "حذف العنصر",
  "Create new list item": "إنشاء عنصر قائمة جديد",
  Create: "إنشاء",
  Add: "إضافة",
  "Toggle section": "تبديل القسم",
  "Select a form field to edit its properties.":
    "اختر حقلاً في النموذج لتعديل خصائصه.",
  "Multiple form fields are selected. Select a single form field to edit its properties.":
    "تم تحديد عدة حقول. اختر حقلاً واحداً لتعديل خصائصه.",

  // Date picker (flatpickr) — the calendar renders inline (static), so its month
  // dropdown and weekday headers are translated here too. Month names are the
  // full forms used in the dropdown; weekdays are the short column headers.
  January: "يناير",
  February: "فبراير",
  March: "مارس",
  April: "أبريل",
  May: "مايو",
  June: "يونيو",
  July: "يوليو",
  August: "أغسطس",
  September: "سبتمبر",
  October: "أكتوبر",
  November: "نوفمبر",
  December: "ديسمبر",
  Sun: "أحد",
  Mon: "إثنين",
  Tue: "ثلاثاء",
  Wed: "أربعاء",
  Thu: "خميس",
  Fri: "جمعة",
  Sat: "سبت",
};

// form-js renders the palette only once (it doesn't re-render on a language
// change), so once we've swapped its text to Arabic we also need to be able to
// swap back. Build the reverse table so switching to English restores the
// originals. (`Object.fromEntries` keeps the last entry on the rare duplicate,
// which is fine — those map back to the same English word.)
const en: Record<string, string> = Object.fromEntries(
  Object.entries(ar).map(([english, arabic]) => [arabic, english]),
);

const TABLES: Record<string, Record<string, string>> = { ar, en };

function translateFormString(text: string): string {
  const language = (i18n.resolvedLanguage ?? i18n.language ?? "en").split(
    "-",
  )[0];
  return TABLES[language]?.[text] ?? text;
}

// Regions whose text we translate: the palette, the properties panel, and the
// form preview. The preview holds the form's own field labels — those are only
// translated when they *exactly* match a known English string (a field-type
// default such as "Radio group" / "Date"); anything the user types themselves
// won't match the table and is left verbatim. Note this is display-only: the
// saved schema keeps the underlying label, so it round-trips to English.
const TRANSLATE_ROOTS =
  ".fjs-palette-container, .fjs-editor-properties-container, .fjs-form-container";
const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label"] as const;

function isTranslatable(node: Node): boolean {
  const element =
    node instanceof Element ? node : (node.parentElement ?? null);
  return Boolean(element?.closest(TRANSLATE_ROOTS));
}

function translateTextNodes(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const raw = node.nodeValue;
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed || !isTranslatable(node)) continue;
    const translated = translateFormString(trimmed);
    if (translated !== trimmed) {
      node.nodeValue = raw.replace(trimmed, translated);
    }
  }
}

function translateAttributes(root: HTMLElement): void {
  root
    .querySelectorAll<HTMLElement>("[placeholder], [title], [aria-label]")
    .forEach((el) => {
      if (!el.closest(TRANSLATE_ROOTS)) return;
      for (const attr of TRANSLATABLE_ATTRS) {
        const value = el.getAttribute(attr)?.trim();
        if (!value) continue;
        const translated = translateFormString(value);
        if (translated !== value) el.setAttribute(attr, translated);
      }
    });
}

// Translate the form-editor chrome inside `container` and keep it translated as
// the panel re-renders and the language changes. Returns a cleanup that stops
// observing and unsubscribes.
export function installFormEditorI18n(container: HTMLElement): () => void {
  let scheduled = false;

  const apply = (): void => {
    scheduled = false;
    // We deliberately keep observing while we mutate. Re-translating an
    // already-translated node is a no-op (the table only maps the *source*
    // language), so our own writes can't loop. Crucially, *not* disconnecting
    // means a concurrent write from form-js/preact — e.g. a tooltip
    // repositioning and resetting its text back to English — is always observed
    // and re-translated, instead of being missed during a disconnect window.
    translateTextNodes(container);
    translateAttributes(container);
  };

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(apply);
  };

  const observer = new MutationObserver(schedule);
  const observe = (): void =>
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRS],
    });

  translateTextNodes(container);
  translateAttributes(container);
  observe();

  i18n.on("languageChanged", schedule);

  return () => {
    observer.disconnect();
    i18n.off("languageChanged", schedule);
  };
}
