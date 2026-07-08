import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { verifyReceipt } from '@/lib/utils/receipt';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    // Use auth client (respects cookies) for both id lookup and user lookup so RLS is enforced
    const supabaseAuth = await createServerSupabase();

    // If id is provided, attempt to fetch by id using the auth client (RLS will decide access)
    // If a signed receipt is present (cookie or query) verify it before returning row for anonymous users
    const signedFromCookie = req.cookies.get('get_listed_receipt')?.value;
    const signedQuery = url.searchParams.get('signed');
    if (id) {
      const signedToken = signedQuery || signedFromCookie || null;
      if (signedToken) {
        const ok = verifyReceipt(signedToken);
        if (!ok) return NextResponse.json({ success: false, error: 'Invalid receipt' }, { status: 400 });
        // token valid: allow the id lookup (RLS + auth client will ensure safety)
        const { data, error } = await supabaseAuth.from('form_submissions').select('*').eq('id', Number(id)).maybeSingle();
        if (error) return NextResponse.json({ success: false, error: 'DB error' }, { status: 500 });
        return NextResponse.json({ success: true, submission: data ?? null });
      }
      // no signed token: fallthrough to normal auth-based behavior which will return data only if user owns it
      const { data, error } = await supabaseAuth.from('form_submissions').select('*').eq('id', Number(id)).maybeSingle();
      if (error) return NextResponse.json({ success: false, error: 'DB error' }, { status: 500 });
      return NextResponse.json({ success: true, submission: data ?? null });
    }
    let userId: string | null = null;
    try {
      const sessionRes = await supabaseAuth.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userId = (sessionRes as any)?.data?.user?.id ?? null;
    } catch {
      userId = null;
    }

    if (!userId) return NextResponse.json({ success: true, submission: null });

    const { data, error } = await supabaseAuth
      .from('form_submissions')
      .select('*')
      .eq('uploaded_by', userId)
      .eq('form_type', 'get-listed')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ success: false, error: 'DB error' }, { status: 500 });
    return NextResponse.json({ success: true, submission: data ?? null });
  } catch (err) {
    console.error('latest submission error', err);
    return NextResponse.json({ success: false, error: 'Internal' }, { status: 500 });
  }
}
