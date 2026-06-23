// Makes the @testing-library/jest-dom matchers (toHaveClass, toHaveAttribute,
// toBeInTheDocument, …) known to the type-checker for the DOM component tests.
// The runtime registration lives in vitest.setup.ts; this only supplies the
// `declare module "vitest"` augmentation so `expect(...)` typechecks in tests.
import "@testing-library/jest-dom/vitest";
