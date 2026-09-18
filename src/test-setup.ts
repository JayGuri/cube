// jest-dom matchers are only meaningful in a DOM environment; component tests
// opt into jsdom per file, and importing this in a node-environment test file
// would otherwise throw.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')
}
