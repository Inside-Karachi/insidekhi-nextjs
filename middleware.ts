import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminRoute, isStaffRoute } from "@/lib/middleware/admin";
import { requireAdmin, requireStaff } from "@/lib/auth/admin";
import {
  checkMaintenanceMode,
  isSuperAdmin,
} from "@/lib/middleware/maintenance";

export async function middleware(request: NextRequest) {
  // Accumulate refreshed auth cookies so they can be applied to any response
  // (next, redirect, or error) before it leaves middleware.
  const pendingCookies: {
    name: string;
    value: string;
    options: CookieOptions;
  }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          pendingCookies.length = 0;
          pendingCookies.push(...cookiesToSet);
          // Forward refreshed tokens to downstream handlers via request cookies
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
        },
      },
    }
  );

  // Apply accumulated auth cookies to any response before returning
  function withCookies<T extends NextResponse>(res: T): T {
    for (const { name, value, options } of pendingCookies) {
      res.cookies.set(name, value, options);
    }
    return res;
  }

  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const middlewareAuth = sessionUser
    ? { id: sessionUser.id, email: sessionUser.email }
    : undefined;

  // Check for maintenance mode (unless accessing maintenance page, auth routes, or static assets)
  const isMaintenancePage = request.nextUrl.pathname === "/maintenance";
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/reset-password") ||
    request.nextUrl.pathname.startsWith("/verify-email") ||
    request.nextUrl.pathname.startsWith("/api/auth");
  const isStaticAsset =
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/__nextjs") ||
    request.nextUrl.pathname.includes("/logo") ||
    request.nextUrl.pathname.includes("/favicon") ||
    request.nextUrl.pathname.match(
      /\.(jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/
    );

  if (!isMaintenancePage && !isAuthRoute && !isStaticAsset) {
    const userIsSuperAdmin = await isSuperAdmin(request, middlewareAuth?.id);

    if (!userIsSuperAdmin) {
      const maintenanceStatus = await checkMaintenanceMode(request);

      if (maintenanceStatus && maintenanceStatus.enabled) {
        const url = request.nextUrl.clone();
        url.pathname = "/maintenance";
        return withCookies(NextResponse.redirect(url));
      }
    }
  }

  if (isAdminRoute(request.nextUrl.pathname)) {
    if (isStaffRoute(request.nextUrl.pathname)) {
      try {
        await requireStaff(request, middlewareAuth);
      } catch (_error) {
        const url = request.nextUrl.clone();

        if (url.pathname.startsWith("/api/admin")) {
          return withCookies(
            NextResponse.json(
              { error: "Staff access required" },
              { status: 403 }
            )
          );
        }

        url.pathname = "/login";
        url.searchParams.set("returnUrl", request.nextUrl.pathname);
        return withCookies(NextResponse.redirect(url));
      }
    } else {
      try {
        await requireAdmin(request, middlewareAuth);
      } catch (_error) {
        const url = request.nextUrl.clone();

        if (url.pathname.startsWith("/api/admin")) {
          return withCookies(
            NextResponse.json(
              { error: "Admin access required" },
              { status: 403 }
            )
          );
        }

        url.pathname = "/login";
        url.searchParams.set("returnUrl", request.nextUrl.pathname);
        return withCookies(NextResponse.redirect(url));
      }
    }
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  response.headers.set("x-pathname", request.nextUrl.pathname);

  return withCookies(response);
}

export const config = {
  matcher: [
    "/((?!monitoring|api|_next|__nextjs|favicon\\.ico|.*\\..+$).*)",
    "/api/admin/:path*",
  ],
};
