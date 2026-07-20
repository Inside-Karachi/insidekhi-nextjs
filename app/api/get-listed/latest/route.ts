import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { verifyReceipt } from '@/lib/utils/receipt';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const session = await getSession(req);

    // If id is provided, attempt to fetch by id.
    // If a signed receipt is present (cookie or query) verify it before returning row for anonymous users
    const signedFromCookie = req.cookies.get('get_listed_receipt')?.value;
    const signedQuery = url.searchParams.get('signed');
    if (id) {
      const signedToken = signedQuery || signedFromCookie || null;
      if (signedToken) {
        const ok = verifyReceipt(signedToken);
        if (!ok) return NextResponse.json({ success: false, error: 'Invalid receipt' }, { status: 400 });
        // token valid: allow the id lookup - the signed receipt itself is the authorization proof
        const { rows } = await query(
          `SELECT * FROM form_submissions WHERE id = $1 LIMIT 1`,
          [Number(id)]
        );
        return NextResponse.json({ success: true, submission: rows[0] ?? null });
      }
      // no signed token: only the submission's owner may look it up by id
      if (!session) return NextResponse.json({ success: true, submission: null });
      const { rows } = await query(
        `SELECT * FROM form_submissions WHERE id = $1 AND uploaded_by = $2 LIMIT 1`,
        [Number(id), session.userId]
      );
      return NextResponse.json({ success: true, submission: rows[0] ?? null });
    }

    if (!session) return NextResponse.json({ success: true, submission: null });

    const { rows } = await query(
      `SELECT * FROM form_submissions
       WHERE uploaded_by = $1 AND form_type = 'get-listed'
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [session.userId]
    );

    return NextResponse.json({ success: true, submission: rows[0] ?? null });
  } catch (err) {
    console.error('latest submission error', err);
    return NextResponse.json({ success: false, error: 'Internal' }, { status: 500 });
  }
}
