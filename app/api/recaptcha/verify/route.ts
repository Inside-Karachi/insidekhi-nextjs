import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptcha } from '@/lib/utils/recaptcha';

export const runtime = 'nodejs';

/**
 * Diagnostic verification endpoint. Form routes call `verifyRecaptcha` from
 * `lib/utils/recaptcha.ts` directly; this endpoint remains as a generic
 * proxy so future client- or server-side callers have a single URL to hit.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token: string | undefined = body?.token;
    const action: string = typeof body?.action === 'string' && body.action ? body.action : 'verify';

    const result = await verifyRecaptcha({ token, action });

    if (result.ok) {
      return NextResponse.json({ success: true, score: result.score, action: result.action });
    }

    return NextResponse.json(
      {
        success: false,
        reason: result.reason,
        message: result.message,
        score: result.score ?? null,
        errorCodes: result.errorCodes ?? [],
      },
      { status: result.status }
    );
  } catch (err) {
    console.error('[reCAPTCHA] /api/recaptcha/verify route error', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
