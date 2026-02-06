/**
 * subscription.tsx
 * Fallback that exports the native implementation
 * (Metro bundler picks .web.tsx for web, this for native)
 */

export { default } from './subscription.native';
