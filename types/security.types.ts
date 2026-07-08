/**
 * Security Center Type Definitions
 *
 * These types support the security monitoring system including
 * event tracking, IP blocking, and system configuration.
 */

import type { Database } from "./supabase";

// Use Supabase-generated types
type Json = Database["public"]["Tables"]["security_events"]["Row"]["details"];

// =====================================================
// SECURITY EVENTS
// =====================================================

export type SecurityEventType =
  // Authentication
  | "failed_login"
  | "successful_login"
  | "brute_force_detected"
  | "session_hijack_attempt"
  | "multiple_sessions"
  | "password_reset_requested"
  | "account_locked"

  // API & Rate Limiting
  | "rate_limit_exceeded"
  | "suspicious_ip"
  | "unusual_activity"

  // Admin Actions
  | "admin_access_denied"
  | "bulk_operation_attempted"
  | "export_requested"
  | "unauthorized_access_attempt"

  // System Events
  | "service_role_usage"
  | "config_changed"
  | "maintenance_mode_toggled";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export interface SecurityEvent {
  id: number;
  event_type: SecurityEventType;
  severity: SecuritySeverity;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  endpoint?: string;
  method?: string;
  request_count: number;
  details: Json;
  country_code?: string;
  city?: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  auto_blocked: boolean;
  block_duration_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface SecurityEventWithUserDetails extends SecurityEvent {
  user_email?: string;
  user_full_name?: string;
  user_role?: string;
  resolved_by_email?: string;
  resolved_by_name?: string;
}

export interface CreateSecurityEventData {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  requestCount?: number;
  details?: Json;
  autoBlock?: boolean;
  blockDurationMinutes?: number;
}

// =====================================================
// RATE LIMITING
// =====================================================

export interface RateLimitViolation {
  id: number;
  endpoint: string;
  ip_address: string;
  user_id?: string;
  request_count: number;
  limit_threshold: number;
  window_start: string;
  window_end: string;
  blocked: boolean;
  block_expires_at?: string;
  user_agent?: string;
  request_headers: Json;
  created_at: string;
}

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request) => Promise<Response>;
}

// =====================================================
// BLOCKED IPS
// =====================================================

export interface BlockedIP {
  id: number;
  ip_address: string;
  reason: string;
  severity: SecuritySeverity;
  blocked_at: string;
  expires_at?: string;
  is_permanent: boolean;
  auto_blocked: boolean;
  blocked_by?: string;
  security_event_id?: number;
  unblocked_at?: string;
  unblocked_by?: string;
  total_violations: number;
  last_violation_at: string;
}

export interface BlockIPRequest {
  ip_address: string;
  reason: string;
  severity: SecuritySeverity;
  duration_minutes?: number;
  security_event_id?: number;
}

export interface UnblockIPRequest {
  ip_address: string;
}

// =====================================================
// SYSTEM CONFIGURATION
// =====================================================

export type SystemConfigType = "feature_flag" | "threshold" | "setting";

export interface SystemConfig {
  id: number;
  config_key: string;
  config_value: unknown;
  config_type: SystemConfigType;
  is_public: boolean;
  requires_restart: boolean;
  description?: string;
  valid_values?: unknown;
  default_value?: unknown;
  updated_by?: string;
  updated_at: string;
  created_at: string;
}

export interface UpdateSystemConfigRequest {
  config_key: string;
  config_value: unknown;
}

// Security configuration keys
export const SecurityConfigKeys = {
  FAILED_LOGIN_THRESHOLD: "security.failed_login_threshold",
  RATE_LIMIT_DEFAULT: "security.rate_limit_default",
  AUTO_BLOCK_ENABLED: "security.auto_block_enabled",
  BLOCK_DURATION_MINUTES: "security.block_duration_minutes",
  BRUTE_FORCE_THRESHOLD: "security.brute_force_threshold",
} as const;

// System configuration keys
export const SystemConfigKeys = {
  MAINTENANCE_MODE: "maintenance.mode_enabled",
  POLLING_INTERVAL: "monitoring.polling_interval_ms",
  REALTIME_ENABLED: "monitoring.realtime_enabled",
} as const;

// =====================================================
// SYSTEM HEALTH METRICS
// =====================================================

export type SystemMetricType =
  | "api_response_time_ms"
  | "db_query_time_ms"
  | "db_connection_count"
  | "memory_usage_mb"
  | "auth_requests_per_minute"
  | "rest_requests_per_minute"
  | "realtime_connections"
  | "error_rate_percent"
  | "active_users"
  | "cache_hit_rate";

export interface SystemHealthMetric {
  id: number;
  metric_type: SystemMetricType;
  metric_value: number;
  threshold_value?: number;
  threshold_exceeded: boolean;
  endpoint?: string;
  details: Json;
  captured_at: string;
}

export interface CreateHealthMetricData {
  metricType: SystemMetricType;
  metricValue: number;
  thresholdValue?: number;
  thresholdExceeded?: boolean;
  endpoint?: string;
  details?: Json;
}

// =====================================================
// SECURITY SUMMARY
// =====================================================

export interface SecuritySummary {
  total_events: number;
  critical_events: number;
  high_events: number;
  medium_events: number;
  low_events: number;
  unresolved_events: number;
  blocked_ips: number;
  failed_logins: number;
  rate_limit_violations: number;
  unique_ips: number;
  auto_blocked_events: number;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface SecurityEventsResponse {
  events: SecurityEventWithUserDetails[];
  total: number;
  limit: number;
  offset: number;
}

export interface BlockedIPsResponse {
  blocked_ips: BlockedIP[];
  total: number;
  active_blocks: number;
}

export interface SecurityDashboardStats {
  summary: SecuritySummary;
  recent_events: SecurityEventWithUserDetails[];
  top_blocked_ips: BlockedIP[];
  metrics: SystemHealthMetric[];
}

// =====================================================
// FILTERS & QUERY PARAMS
// =====================================================

export interface SecurityEventFilters {
  severity?: SecuritySeverity;
  event_type?: SecurityEventType;
  resolved?: boolean;
  user_id?: string;
  ip_address?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface HealthMetricFilters {
  metric_type?: SystemMetricType;
  threshold_exceeded?: boolean;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

// =====================================================
// REALTIME SUBSCRIPTIONS
// =====================================================

export interface SecurityEventRealtimePayload {
  event: "INSERT" | "UPDATE" | "DELETE";
  old: SecurityEvent | null;
  new: SecurityEvent | null;
}

export interface BlockedIPRealtimePayload {
  event: "INSERT" | "UPDATE" | "DELETE";
  old: BlockedIP | null;
  new: BlockedIP | null;
}

// =====================================================
// UI COMPONENT PROPS
// =====================================================

export interface SecurityEventCardProps {
  event: SecurityEventWithUserDetails;
  onResolve?: (eventId: number, notes: string) => Promise<void>;
  onBlockIP?: (ipAddress: string) => Promise<void>;
}

export interface BlockedIPRowProps {
  blockedIP: BlockedIP;
  onUnblock?: (ipAddress: string) => Promise<void>;
  onViewDetails?: (blockedIP: BlockedIP) => void;
}

export interface SystemConfigRowProps {
  config: SystemConfig;
  onUpdate?: (key: string, value: unknown) => Promise<void>;
  disabled?: boolean;
}

// =====================================================
// FORM DATA TYPES
// =====================================================

export interface BlockIPFormData {
  ip_address: string;
  reason: string;
  severity: SecuritySeverity;
  duration_type: "temporary" | "permanent";
  duration_minutes?: number;
}

export interface ResolveEventFormData {
  resolution_notes: string;
}

export interface UpdateConfigFormData {
  config_key: string;
  config_value: unknown;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export interface IPGeolocation {
  ip: string;
  country_code?: string;
  country_name?: string;
  city?: string;
  region?: string;
  timezone?: string;
}

export interface SecurityAlert {
  id: string;
  title: string;
  message: string;
  severity: SecuritySeverity;
  event_id?: number;
  timestamp: string;
  acknowledged: boolean;
}

// =====================================================
// CHART DATA TYPES
// =====================================================

export interface EventTypeChartData {
  event_type: SecurityEventType;
  count: number;
  percentage: number;
}

export interface SeverityChartData {
  severity: SecuritySeverity;
  count: number;
  color: string;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
}

export interface MetricTrendData {
  metric_type: SystemMetricType;
  data: TimeSeriesData[];
  threshold?: number;
}
