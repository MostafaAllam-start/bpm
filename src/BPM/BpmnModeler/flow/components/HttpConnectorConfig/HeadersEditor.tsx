import { useTranslation } from "react-i18next";
import type { HttpHeader } from "../../utils/httpConnector.ts";

type HeadersEditorProps = {
  headers: HttpHeader[];
  onChange: (next: HttpHeader[]) => void;
};

export function HeadersEditor({ headers, onChange }: HeadersEditorProps) {
  const { t } = useTranslation("bpmn");

  const add = () => onChange([...headers, { key: "", value: "" }]);
  const remove = (i: number) => onChange(headers.filter((_, idx) => idx !== i));
  const setKey = (i: number, key: string) =>
    onChange(headers.map((h, idx) => (idx === i ? { ...h, key } : h)));
  const setValue = (i: number, value: string) =>
    onChange(headers.map((h, idx) => (idx === i ? { ...h, value } : h)));

  return (
    <div className="bf-http-headers">
      {headers.map((h, i) => (
        <div key={i} className="bf-http-kv-row">
          <input
            className="bf-http-kv-key"
            value={h.key}
            placeholder={t("props.httpHeaderKey")}
            onChange={(e) => setKey(i, e.target.value)}
          />
          <input
            className="bf-http-kv-val"
            value={h.value}
            placeholder={t("props.httpHeaderValue")}
            onChange={(e) => setValue(i, e.target.value)}
          />
          <button type="button" className="bf-http-row-remove" onClick={() => remove(i)} title="Remove">
            ×
          </button>
        </div>
      ))}
      <button type="button" className="bf-http-add-btn" onClick={add}>
        + {t("props.httpAddHeader")}
      </button>
    </div>
  );
}
