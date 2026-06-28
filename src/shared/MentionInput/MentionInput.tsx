import "./MentionInput.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { makeChip } from "./MentionChip";
import MentionDropdown from "./MentionDropdown";
import type { MentionGroup, MentionVar } from "./types";

export type MentionInputProps = {
  value: string;
  onChange: (v: string) => void;
  groups: MentionGroup[];
  tokenLabels: Map<string, string>;
  placeholder?: string;
  surfaceClassName?: string;
  className?: string;
  dir?: "ltr" | "rtl" | "auto";
  multiline?: boolean;
};

const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"]);

function isChip(node: Node | null | undefined): node is HTMLElement {
  return (
    !!node &&
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).classList.contains("mention-chip")
  );
}

// The chip immediately before a collapsed caret — so Backspace removes the
// whole variable even when a zero-width caret-helper sits between chip and caret.
function chipBeforeCaret(range: Range): HTMLElement | null {
  const { startContainer: c, startOffset: o } = range;
  if (c.nodeType === Node.TEXT_NODE) {
    if ((c.textContent ?? "").slice(0, o).replace(/​/g, "") !== "")
      return null;
    return isChip(c.previousSibling) ? c.previousSibling : null;
  }
  const prev = c.childNodes[o - 1] ?? null;
  return isChip(prev) ? prev : null;
}

export default function MentionInput({
  value,
  onChange,
  groups,
  tokenLabels,
  placeholder,
  surfaceClassName,
  className,
  dir,
  multiline,
}: MentionInputProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<{ node: Text; at: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        vars: q ? g.vars.filter((v) => v.name.toLowerCase().includes(q)) : g.vars,
      }))
      .filter((g) => g.vars.length > 0);
  }, [groups, query]);

  const flat = useMemo(() => matches.flatMap((g) => g.vars), [matches]);
  const showList = open && flat.length > 0;

  const close = () => {
    setOpen(false);
    trigger.current = null;
  };

  const serialize = useCallback(
    (el: HTMLElement): string => {
      let out = "";
      el.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? "";
        else if (node instanceof HTMLElement) {
          if (node.dataset.token) out += node.dataset.token;
          else if (node.tagName === "BR") out += "\n";
          else out += node.textContent ?? "";
        }
      });
      out = out.replace(/​/g, "");
      return multiline ? out : out.replace(/\n/g, "");
    },
    [multiline],
  );

  const render = useCallback(
    (el: HTMLElement, text: string) => {
      el.textContent = "";
      const re = /\{[^{}]+\}/g;
      let last = 0;
      let m: RegExpExecArray | null;
      const pushText = (s: string) => {
        if (s) el.appendChild(document.createTextNode(s));
      };
      while ((m = re.exec(text)) !== null) {
        const label = tokenLabels.get(m[0]);
        if (label === undefined) continue;
        pushText(text.slice(last, m.index));
        el.appendChild(makeChip(m[0], label));
        last = m.index + m[0].length;
      }
      pushText(text.slice(last));
    },
    [tokenLabels],
  );

  useEffect(() => {
    const el = ref.current;
    if (el && serialize(el) !== value) render(el, value);
  }, [value, render, serialize]);

  const reanchor = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAnchor({ left: rect.left, top: rect.bottom + 2, width: rect.width });
  }, []);

  const detect = () => {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return close();
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return close();
    const text = node as Text;
    const upto = (text.textContent ?? "").slice(0, sel.anchorOffset);
    const at = upto.lastIndexOf("@");
    if (at === -1) return close();
    if (at > 0 && /[A-Za-z0-9]/.test(upto[at - 1])) return close();
    const q = upto.slice(at + 1);
    if (/[^A-Za-z0-9_.-]/.test(q)) return close();
    trigger.current = { node: text, at };
    setQuery(q);
    setActive(0);
    reanchor();
    setOpen(true);
  };

  const select = (v: MentionVar | undefined) => {
    const el = ref.current;
    const trig = trigger.current;
    const sel = window.getSelection();
    if (!v || !el || !trig || !sel || sel.rangeCount === 0) return;
    const token = `{${v.ref ?? v.name}}`;
    const label =
      tokenLabels.get(token) ??
      (v.origin === "task" && v.source ? `${v.source}.${v.name}` : v.name);
    try {
      const caret = sel.getRangeAt(0);
      const range = document.createRange();
      range.setStart(trig.node, trig.at);
      range.setEnd(caret.endContainer, caret.endOffset);
      range.deleteContents();
      const chip = makeChip(token, label);
      range.insertNode(chip);
      const zwsp = document.createTextNode("​");
      chip.after(zwsp);
      const after = document.createRange();
      after.setStartAfter(zwsp);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    } catch {
      // Range went stale (DOM re-rendered mid-pick) — just close.
    }
    close();
    onChange(serialize(el));
  };

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", reanchor, true);
    window.addEventListener("resize", reanchor);
    return () => {
      window.removeEventListener("scroll", reanchor, true);
      window.removeEventListener("resize", reanchor);
    };
  }, [open, reanchor]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (showList) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, flat.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        select(flat[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
    }
    // Tab with an active @query but no dropdown matches → commit as freeform chip.
    if (e.key === "Tab" && open && query && !showList) {
      e.preventDefault();
      select({ name: query, ref: query, origin: "task" });
      return;
    }
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      return;
    }
    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && sel.rangeCount) {
        const chip = chipBeforeCaret(sel.getRangeAt(0));
        if (chip) {
          e.preventDefault();
          chip.remove();
          if (ref.current) onChange(serialize(ref.current));
        }
      }
    }
  };

  const onInput = () => {
    const el = ref.current;
    if (!el) return;
    onChange(serialize(el));
    detect();
  };

  const onPaste = (e: ReactClipboardEvent) => {
    e.preventDefault();
    const raw = e.clipboardData.getData("text/plain");
    const clean = multiline ? raw : raw.replace(/\s*\n\s*/g, " ");
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const node = document.createTextNode(clean);
    r.insertNode(node);
    const after = document.createRange();
    after.setStartAfter(node);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    if (ref.current) onChange(serialize(ref.current));
  };

  const surfaceCls = [
    "mention-surface",
    multiline ? "is-multiline" : "",
    surfaceClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={`mention-wrap${className ? ` ${className}` : ""}`}>
        <div
          ref={ref}
          className={surfaceCls}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline={multiline}
          dir={dir}
          data-placeholder={placeholder ?? ""}
          onInput={onInput}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => {
            if (!NAV_KEYS.has(e.key)) detect();
          }}
          onClick={detect}
          onBlur={close}
        />
      </div>
      {showList && anchor && (
        <MentionDropdown
          groups={matches}
          flat={flat}
          activeIndex={active}
          anchor={anchor}
          onSelect={select}
          onHover={setActive}
        />
      )}
    </>
  );
}
