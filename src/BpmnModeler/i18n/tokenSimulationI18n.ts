import i18n from "../../i18n";
import { translateBpmnString } from "./bpmnTranslations.ts";

// The bpmn-js-token-simulation add-on hardcodes its UI strings in DOM templates
// instead of routing them through diagram-js's `translate` service, so the
// service override can't reach them. Everything it renders is marked with a
// `bts-*` class, so we translate those nodes in place — scoping to `bts-*`
// keeps user element labels on the canvas untouched — and re-run on DOM changes
// (new log entries, toggling) and on language change.

const BTS_ANCESTOR = '[class*="bts-"]';
const TRANSLATABLE_ATTRS = ["title", "aria-label"] as const;

function isInsideTokenSim(node: Node): boolean {
  const element =
    node instanceof Element ? node : (node.parentElement ?? null);
  return Boolean(element?.closest(BTS_ANCESTOR));
}

function translateTextNodes(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (
    let node = walker.nextNode();
    node;
    node = walker.nextNode()
  ) {
    const raw = node.nodeValue;
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed || !isInsideTokenSim(node)) continue;
    const translated = translateBpmnString(trimmed);
    if (translated !== trimmed) {
      node.nodeValue = raw.replace(trimmed, translated);
    }
  }
}

function translateAttributes(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[title], [aria-label]").forEach((el) => {
    if (!el.closest(BTS_ANCESTOR)) return;
    for (const attr of TRANSLATABLE_ATTRS) {
      const value = el.getAttribute(attr)?.trim();
      if (!value) continue;
      const translated = translateBpmnString(value);
      if (translated !== value) el.setAttribute(attr, translated);
    }
  });
}

// Translate the token-simulation UI inside `container` and keep it translated.
// Returns a cleanup that stops observing and unsubscribes.
export function installTokenSimulationI18n(container: HTMLElement): () => void {
  let scheduled = false;

  const apply = (): void => {
    scheduled = false;
    // Pause observation while we mutate so our own changes don't re-trigger us.
    observer.disconnect();
    translateTextNodes(container);
    translateAttributes(container);
    observe();
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
