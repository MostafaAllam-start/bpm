import { fileURLToPath, URL } from 'node:url'

// Single source of truth for the build/test path aliases. Mirrored (by hand) in
// tsconfig.app.json `paths` for the type-checker and editor. These are
// string-prefix aliases — `@forms/types.ts` resolves to `<root>/src/forms` +
// `/types.ts`, leaving the explicit .ts/.tsx suffix intact.
//
// `@bpmn` points at src/BpmnModeler until that folder is renamed to src/bpmn;
// only this line changes then. `@shared`/`@app` targets are created later in the
// restructure — an alias whose dir doesn't exist yet is harmless until imported.
const at = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export const aliases: Record<string, string> = {
  '@': at('./src'),
  '@forms': at('./src/forms'),
  '@bpmn': at('./src/BpmnModeler'),
  '@shared': at('./src/shared'),
  '@app': at('./src/app'),
}
