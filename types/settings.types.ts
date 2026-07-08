export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  notifications?: {
    email?: boolean;
    bookings?: boolean;
    reviews?: boolean;
    marketing?: boolean;
  };
  location?: {
    lat?: number;
    lng?: number;
    name?: string;
  };
}

export interface UserSettingsProfile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  user_preferences?: UserPreferences;
}

// API Response types
export interface SettingsApiResponse {
  success: boolean;
  settings?: UserPreferences;
  message?: string;
}

export interface UpdateSettingsRequest {
  userPreferences: UserPreferences;
}

// Component prop types
export interface PremiumSettingsPageProps {
  profile: UserSettingsProfile | null;
}
