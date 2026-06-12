import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Open to everyone, never redirected: legal pages (users must be able to read
  // what they agree to) and the Stripe webhook (an unauthenticated server-to-
  // server POST that authenticates via signature, not a session cookie).
  const openPaths = ["/terms", "/privacy", "/cookies", "/api/stripe/webhook"];
  if (openPaths.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  // Auth pages are for signed-out users only.
  const authPaths = ["/login", "/signup"];
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Suspended users are locked out of the app (kept reversible — not deleted).
  if (user) {
    const { data: me } = await supabase.from("profiles").select("suspended").eq("id", user.id).single();
    if (me?.suspended) {
      if (pathname !== "/suspended") {
        const url = request.nextUrl.clone();
        url.pathname = "/suspended";
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }
    if (pathname === "/suspended") {
      const url = request.nextUrl.clone();
      url.pathname = "/flux";
      return NextResponse.redirect(url);
    }
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/flux";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
