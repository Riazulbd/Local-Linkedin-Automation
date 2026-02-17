import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  noStore();
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);

    const latest = searchParams.get('latest') === 'true';
    const runId = searchParams.get('runId');
    const profileId = searchParams.get('profileId');

    if (latest) {
      let query = supabase
        .from('execution_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1);

      if (profileId) {
        query = query.eq('profile_id', profileId);
      }

      const { data, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(
        { run: data?.[0] ?? null },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    if (runId) {
      const [runResult, logsResult] = await Promise.all([
        supabase.from('execution_runs').select('*').eq('id', runId).maybeSingle(),
        supabase
          .from('execution_logs')
          .select('*')
          .eq('run_id', runId)
          .order('created_at', { ascending: true }),
      ]);

      if (runResult.error) {
        return NextResponse.json({ error: runResult.error.message }, { status: 500 });
      }

      if (logsResult.error) {
        return NextResponse.json({ error: logsResult.error.message }, { status: 500 });
      }

      return NextResponse.json(
        {
          run: runResult.data,
          logs: logsResult.data ?? [],
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    let query = supabase
      .from('execution_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(25);

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { runs: data ?? [] },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch execution data' },
      { status: 500 }
    );
  }
}
