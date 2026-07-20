import { query } from "@/lib/db";
import type {
  ChannelOverrides,
  EffectiveChannelConfig,
  NotificationChannel,
  NotificationChannelConfig,
  NotificationPreferenceRecord,
} from "@/types/notifications.types";

const CHANNELS: NotificationChannel[] = ["bell", "email", "push"];

const DEFAULT_CHANNEL_CONFIG: NotificationChannelConfig = {
  bell: true,
  email: false,
  push: false,
};

type RawChannelConfig = Record<string, unknown> | null | undefined;

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }
  return fallback;
}

function parseChannelConfig(raw: RawChannelConfig): NotificationChannelConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_CHANNEL_CONFIG };
  }

  const config = { ...DEFAULT_CHANNEL_CONFIG };
  CHANNELS.forEach((channel) => {
    config[channel] = toBoolean(
      (raw as Record<string, unknown>)[channel],
      config[channel]
    );
  });
  return config;
}

function applyPreferenceOverrides(
  base: NotificationChannelConfig,
  preferences: NotificationPreferenceRecord[]
): NotificationChannelConfig {
  if (!preferences.length) {
    return base;
  }

  const config = { ...base };
  preferences.forEach((preference) => {
    config[preference.channel] = preference.enabled;
  });
  return config;
}

function applyManualOverrides(
  base: NotificationChannelConfig,
  overrides?: ChannelOverrides
): NotificationChannelConfig {
  if (!overrides) {
    return base;
  }

  const config = { ...base };
  CHANNELS.forEach((channel) => {
    const override = overrides[channel];
    if (typeof override === "boolean") {
      config[channel] = override;
    }
  });
  return config;
}

function enforceMandatoryChannels(
  base: NotificationChannelConfig,
  isMandatory: boolean
): NotificationChannelConfig {
  if (!isMandatory) {
    return base;
  }

  const config = { ...base };
  const hasEnabledChannel = CHANNELS.some((channel) => config[channel]);
  if (!hasEnabledChannel) {
    config.bell = true;
  }
  return config;
}

export async function getEffectiveChannelConfig(
  profileId: string,
  categorySlug: string,
  overrides?: ChannelOverrides
): Promise<EffectiveChannelConfig> {
  const { rows: categoryRows } = await query(
    `SELECT * FROM public.notification_categories WHERE slug = $1 LIMIT 1`,
    [categorySlug]
  );
  const category = categoryRows[0];

  if (!category) {
    throw new Error(
      `Failed to load notification category ${categorySlug}: not found`
    );
  }

  const defaults = parseChannelConfig(
    category.default_channel_config as RawChannelConfig
  );

  const { rows: preferences } = await query(
    `SELECT * FROM public.notification_preferences
     WHERE profile_id = $1 AND category_slug = $2`,
    [profileId, categorySlug]
  );

  const withUserPrefs = applyPreferenceOverrides(
    defaults,
    preferences as NotificationPreferenceRecord[]
  );
  const withOverrides = applyManualOverrides(withUserPrefs, overrides);
  const finalConfig = enforceMandatoryChannels(
    withOverrides,
    category.is_mandatory
  );

  return {
    category,
    config: finalConfig,
    preferences: preferences as NotificationPreferenceRecord[],
  };
}

export function getEnabledChannels(
  config: NotificationChannelConfig
): NotificationChannel[] {
  return CHANNELS.filter((channel) => config[channel]);
}

export function getDefaultChannelConfig(): NotificationChannelConfig {
  return { ...DEFAULT_CHANNEL_CONFIG };
}
