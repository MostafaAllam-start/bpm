import { fileURLToPath, URL } from 'node:url'

// Single source of truth for the build/test path aliases. Mirrored (by hand) in
// tsconfig.app.json `paths` for the type-checker and editor. These are
// string-prefix aliases — `@FormBuilder/types.ts` resolves to `<root>/src/FormBuilder` +
// `/types.ts`, leaving the explicit .ts/.tsx suffix intact.
//
// `@bpmn` points at src/BpmnModeler until that folder is renamed to src/bpmn;
// only this line changes then. `@shared`/`@components` targets are created later
// in the restructure — an alias whose dir doesn't exist yet is harmless until imported.
const at = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export const aliases: Record<string, string> = {
  '@': at('./src'),
  '@FormBuilder': at('./src/FormBuilder'),
  '@bpmn': at('./src/BpmnModeler'),
  '@shared': at('./src/shared'),
  '@components': at('./src/components'),
}
