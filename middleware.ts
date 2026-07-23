import { NextResponse, type NextRequest } from "next/server";
import {
  isAdminRoute,
  isStaffRoute,
  isDataEntryRoute,
} from "@/lib/middleware/admin";
import { getSession } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const sessionUser = await getSession(request);

  // If visiting admin route, restrict solely based on session presence.
  // Let the actual API endpoints/Server Components run direct postgres DB verification (e.g. requireAdmin).
  if (isAdminRoute(request.nextUrl.pathname)) {
    if (!sessionUser) {
      const url = request.nextUrl.clone();
      if (url.pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }
      url.pathname = "/login";
      url.searchParams.set("returnUrl", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Role check bypass inside middleware:
    // Listers are only allowed to access designated staff routes
    const isStaffPath = isStaffRoute(request.nextUrl.pathname);
    const isDataEntryPath = isDataEntryRoute(request.nextUrl.pathname);
    const userRole = sessionUser.role;

    if (userRole === "lister" && !isStaffPath && !isDataEntryPath) {
      const url = request.nextUrl.clone();
      if (url.pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { error: "Forbidden access" },
          { status: 403 },
        );
      }
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // data_entry may only access listing-capacity routes
    if (userRole === "data_entry" && !isDataEntryPath) {
      const url = request.nextUrl.clone();
      if (url.pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { error: "Forbidden access" },
          { status: 403 },
        );
      }
      url.pathname = "/admin/listing-capacity";
      return NextResponse.redirect(url);
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
