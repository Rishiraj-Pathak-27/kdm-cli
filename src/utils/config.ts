import {
  clearConfig as clearStoredConfig,
  deleteLegacyValue,
  getLegacyConfig,
  getLegacyValue,
  setLegacyValue,
} from '../config/store';
import type { LegacyNotificationConfig } from '../config/schema';

/**
 * Retrieves the current legacy notification configuration.
 * @returns The LegacyNotificationConfig object.
 */
export const getConfig = () => getLegacyConfig();

type SensitiveLegacyKey = 'email_password';

const sensitiveLegacyKeys = new Set<keyof LegacyNotificationConfig>(['email_password']);

/**
 * Sets a configuration key to the specified value in the legacy store,
 * throwing an error if trying to set a sensitive key.
 * @param key The configuration key to set.
 * @param value The value to associate with the key.
 */
export const setConfig = <Key extends Exclude<keyof LegacyNotificationConfig, SensitiveLegacyKey>>(
  key: Key,
  value: LegacyNotificationConfig[Key],
) => {
  if (sensitiveLegacyKeys.has(key)) {
    throw new Error(`${key} must not be stored in config. Use the KDM_SMTP_PASSWORD environment variable instead.`);
  }
  setLegacyValue(key, value);
};

/**
 * Deletes a single key from the legacy notification configuration.
 * @param key The configuration key to delete.
 */
export const deleteConfig = (key: keyof LegacyNotificationConfig) => deleteLegacyValue(key);

/**
 * Clears the entire configuration store.
 */
export const clearConfig = () => clearStoredConfig();

/**
 * Deletes all notification-related credentials and configuration keys from the store.
 */
export const clearNotificationCredentials = () => {
  deleteLegacyValue('discord_webhook');
  deleteLegacyValue('email_host');
  deleteLegacyValue('email_port');
  deleteLegacyValue('email_user');
  deleteLegacyValue('email_to');
  deleteLegacyValue('email_password');
};

/**
 * Constructs and retrieves SMTP connection settings from stored configuration
 * and the KDM_SMTP_PASSWORD environment variable.
 * @returns An object containing host, port, authentication credentials, and recipient address.
 */
export const getSMTPSettings = () => {
  return {
    host: getLegacyValue('email_host'),
    port: getLegacyValue('email_port') || 587,
    auth: {
      user: getLegacyValue('email_user'),
      // SMTP password must come from KDM_SMTP_PASSWORD env var only.
      pass: process.env.KDM_SMTP_PASSWORD,
    },
    to: getLegacyValue('email_to'),
  };
};
