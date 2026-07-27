import { NextResponse, type NextRequest } from "next/server";
import {
  isAdminRoute,
  isStaffRoute,
  isDataEntryRoute,
} from "@/lib/middleware/admin";
import { getSession } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const sessionUser = await getSession(request);
  const pathname = request.nextUrl.pathname;

  // data_entry may ONLY access listing-capacity (site-wide, not just under /admin)
  if (sessionUser?.role === "data_entry" && !isDataEntryRoute(pathname)) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json(
        { error: "Forbidden access" },
        { status: 403 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/admin/listing-capacity";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // If visiting admin route, restrict solely based on session presence.
  // Let the actual API endpoints/Server Components run direct postgres DB verification (e.g. requireAdmin).
  if (isAdminRoute(pathname)) {
    if (!sessionUser) {
      const url = request.nextUrl.clone();
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }
      url.pathname = "/login";
      url.searchParams.set("returnUrl", pathname);
      return NextResponse.redirect(url);
    }

    // Listers are only allowed to access designated staff routes
    const isStaffPath = isStaffRoute(pathname);
    const isDataEntryPath = isDataEntryRoute(pathname);
    const userRole = sessionUser.role;

    if (userRole === "lister" && !isStaffPath && !isDataEntryPath) {
      const url = request.nextUrl.clone();
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { error: "Forbidden access" },
          { status: 403 },
        );
      }
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  response.headers.set("x-pathname", pathname);

  return response;
}

export const config = {
  matcher: [
    "/((?!monitoring|api|_next|__nextjs|favicon\\.ico|.*\\..+$).*)",
    "/api/admin/:path*",
  ],
};
