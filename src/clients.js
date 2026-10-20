import axios from 'axios';
import contentfulManagement from 'contentful-management';
import { createClient as createDelivery } from 'contentful';

/**
 * Creates a Management API client.
 *
 * `contentful-management` bundles its own copy of axios (1.15.x at the time
 * of writing) that doesn't use CONNECT tunnelling for HTTPS proxies, so
 * requests through a proxy set via HTTPS_PROXY fail with 405. Supplying the
 * HTTP adapter from the installed top-level axios (>= 1.16.1) avoids that.
 * Without a proxy the adapter behaves identically.
 */
export function createManagementClient(config) {
  return contentfulManagement.createClient({
    accessToken: config.managementToken,
    adapter: axios.getAdapter('http'),
  });
}

/** Creates a Delivery API client bound to the configured space and environment. */
export function createDeliveryClient(config) {
  return createDelivery({
    space: config.spaceId,
    environment: config.environmentId,
    accessToken: config.deliveryToken,
  });
}
