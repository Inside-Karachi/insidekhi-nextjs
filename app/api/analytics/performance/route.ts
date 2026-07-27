import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { query } from "@/lib/db";
import type { Database } from "@/types/supabase";

// Performance metric types matching database enum
const performanceMetricTypeSchema = z.enum([
  "lcp",
  "cls",
  "fid",
  "ttfb",
  "api_latency",
  "api_error_rate",
  "memory_usage",
]);

// Device type detection
const deviceTypeSchema = z.enum(["mobile", "tablet", "desktop"]).optional();

// Performance metric payload schema
const performanceMetricSchema = z.object({
  metricType: performanceMetricTypeSchema,
  value: z.number().positive().finite(),
  page: z.string().max(512).optional(),
  device: deviceTypeSchema,
  source: z.enum(["web", "dashboard", "api"]).default("web"),
  metadata: z.record(z.unknown()).optional(),
});

// Batch performance metrics schema
const performanceMetricsBatchSchema = z.object({
  metrics: z.array(performanceMetricSchema).min(1).max(20),
});

// Union schema for single or batch
const performanceMetricsRequestSchema = z.union([
  performanceMetricSchema,
  performanceMetricsBatchSchema,
]);

type PerformanceMetricInsert =
  Database["public"]["Tables"]["performance_metrics"]["Insert"];

/**
 * POST /api/analytics/performance
 *
 * Accepts performance metrics from client-side tracking (Web Vitals, API latency, etc.)
 * Stores metrics in performance_metrics table for analytics aggregation.
 *
 * Uses service role to bypass RLS - metrics can be captured from anonymous users.
 * Rate limiting should be implemented at edge/CDN level for production.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body with error handling
    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === "") {
        return NextResponse.json(
          {
            error: "Empty request body",
          },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (jsonError) {
      console.error("Performance metrics JSON parse error:", jsonError);
      return NextResponse.json(
        {
          error: "Invalid JSON in request body",
        },
        { status: 400 }
      );
    }

    // Validate schema
    const parsedRequest = performanceMetricsRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parsedRequest.error.errors,
        },
        { status: 400 }
      );
    }

    // Normalize to array
    const metricsArray =
      "metrics" in parsedRequest.data
        ? parsedRequest.data.metrics
        : [parsedRequest.data];

    // Extract request metadata
    const ipAddress = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim();
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const referer = request.headers.get("referer") ?? undefined;

    // Prepare inserts
    const now = new Date().toISOString();
    const inserts: PerformanceMetricInsert[] = metricsArray.map((metric) => ({
      metric_type: metric.metricType,
      value: metric.value,
      page: metric.page ?? referer,
      device: metric.device ?? null,
      source: metric.source,
      metadata: {
        ...(metric.metadata ?? {}),
        user_agent: userAgent,
        ip: ipAddress,
      },
      captured_at: now,
    }));

    try {
      const values: unknown[] = [];
      const placeholders = inserts
        .map((m, i) => {
          const base = i * 7;
          values.push(
            m.metric_type,
            m.value,
            m.page,
            m.device,
            m.source,
            m.metadata,
            m.captured_at,
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
        })
        .join(", ");

      await query(
        `INSERT INTO performance_metrics
           (metric_type, value, page, device, source, metadata, captured_at)
         VALUES ${placeholders}`,
        values,
      );
    } catch (insertError) {
      console.error("Failed to insert performance metrics:", insertError);
      return NextResponse.json(
        {
          error: "Failed to store performance metrics",
        },
        { status: 500 }
      );
    }

    // Success response
    return NextResponse.json(
      {
        success: true,
        recorded: inserts.length,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Performance metrics API error:", error);

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Invalid JSON payload",
        },
        { status: 400 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
