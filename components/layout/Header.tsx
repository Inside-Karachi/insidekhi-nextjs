import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { ThemeAwareLogo } from "./ThemeAwareLogo";
import { UserNav } from "./UserNav";
import { MegaMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";

export async function Header() {
  const supabase = await createServerSupabase({ publicAnon: true });

  const { data: navItems } = await supabase
    .from("categories")
    .select("id, name, slug, categories(id, name, slug)") // Fetch sub-categories for the full menu
    .is("parent_id", null)
    .eq("show_in_nav", true)
    .eq("is_enabled", true)
    .order("id");

  const parentCategoriesWithSub =
    navItems?.filter((item) => item.categories.length > 0) || [];
  const simpleNavLinks =
    navItems?.filter((item) => item.categories.length === 0) || [];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container relative flex h-16 max-w-screen-2xl items-center">
          <div className="flex-1 flex justify-start md:hidden">
            {/* Placeholder for the mobile nav trigger, which is now the BottomNav */}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:relative md:left-auto md:top-auto md:translate-x-0 md:translate-y-0">
            <Link href="/" className="flex items-center space-x-2">
              <ThemeAwareLogo />
            </Link>
          </div>
          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center space-x-1 text-sm font-medium md:flex-1 md:justify-center">
            <MegaMenu />
            {simpleNavLinks.map((item) => (
              <Link
                key={item.id}
                href={
                  item.slug === "guides-reviews"
                    ? "/blog"
                    : `/listings/${item.slug}`
                }
                className="px-4 py-2 transition-colors hover:text-foreground/80 text-foreground/60"
              >
                {item.name}
              </Link>
            ))}
          </nav>
          {/* Right aligned actions div */}
          <div className="hidden md:flex items-center space-x-2">
            <ThemeToggle />
            <UserNav />
          </div>
        </div>
      </header>
      {/* Render Mobile Wrapper */}
      <MobileNav
        categoryNavItems={parentCategoriesWithSub}
        simpleNavLinks={simpleNavLinks}
      />
    </>
  );
}
