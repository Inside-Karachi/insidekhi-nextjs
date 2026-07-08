import { NextResponse, type NextRequest } from "next/server";
import { isAdminRoute, isStaffRoute } from "@/lib/middleware/admin";
import { requireAdmin, requireStaff } from "@/lib/auth/admin";
import {
  checkMaintenanceMode,
  isSuperAdmin,
} from "@/lib/middleware/maintenance";
import { getSession } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const sessionUser = await getSession(request);

  const middlewareAuth = sessionUser
    ? { id: sessionUser.userId, email: sessionUser.email }
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
        return NextResponse.redirect(url);
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
          return NextResponse.json(
            { error: "Staff access required" },
            { status: 403 }
          );
        }

        url.pathname = "/login";
        url.searchParams.set("returnUrl", request.nextUrl.pathname);
        return NextResponse.redirect(url);
      }
    } else {
      try {
        await requireAdmin(request, middlewareAuth);
      } catch (_error) {
        const url = request.nextUrl.clone();

        if (url.pathname.startsWith("/api/admin")) {
          return NextResponse.json(
            { error: "Admin access required" },
            { status: 403 }
          );
        }

        url.pathname = "/login";
        url.searchParams.set("returnUrl", request.nextUrl.pathname);
        return NextResponse.redirect(url);
      }
    }
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  response.headers.set("x-pathname", request.nextUrl.pathname);

  return response;
}

export const config = {
  matcher: [
    "/((?!monitoring|api|_next|__nextjs|favicon\\.ico|.*\\..+$).*)",
    "/api/admin/:path*",
  ],
};

