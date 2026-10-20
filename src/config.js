import 'dotenv/config';

const REQUIRED = [
  'CONTENTFUL_SPACE_ID',
  'CONTENTFUL_ENVIRONMENT',
  'CONTENTFUL_MANAGEMENT_TOKEN',
  'CONTENTFUL_DELIVERY_TOKEN',
];

const OPTIONAL = ['CONTENTFUL_PREVIEW_TOKEN'];

/**
 * Reads Contentful settings from the environment (with .env as a fallback).
 * Returns the resolved config plus the list of missing required names so
 * callers can decide whether to fail.
 */
export function loadConfig() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  return {
    spaceId: process.env.CONTENTFUL_SPACE_ID,
    environmentId: process.env.CONTENTFUL_ENVIRONMENT,
    managementToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
    deliveryToken: process.env.CONTENTFUL_DELIVERY_TOKEN,
    previewToken: process.env.CONTENTFUL_PREVIEW_TOKEN,
    missing,
    required: REQUIRED,
    optional: OPTIONAL,
  };
}

/** Masks a secret for logging: first 4 characters followed by an ellipsis. */
export function mask(value) {
  if (!value) return '(unset)';
  return `${value.slice(0, 4)}…`;
}
