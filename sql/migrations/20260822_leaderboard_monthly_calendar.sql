-- refresh_leaderboard_monthly() was using a rolling 30-day window
-- (CURRENT_DATE - INTERVAL '30 days'), so it never actually reset on
-- calendar month boundaries - it just slid forward one day at a time.
-- Switch to date_trunc('month', CURRENT_DATE) so the "This Month"
-- leaderboard covers the 1st of the current month through today, and
-- rolls over to a fresh set of standings on the 1st of each new month.
--
-- Also see app/api/cron/refresh-leaderboard/route.ts + vercel.json -
-- previously nothing ever called refresh_leaderboard_cache() (no
-- pg_cron job, no Vercel cron entry), so the cache was frozen at
-- whatever it was last manually refreshed to.

CREATE OR REPLACE FUNCTION public.refresh_leaderboard_monthly()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows_inserted INTEGER := 0;
  v_month_start DATE := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  -- Delete old monthly entries
  DELETE FROM leaderboard_cache
  WHERE period_type = 'monthly';

  -- Insert new monthly leaderboard
  INSERT INTO leaderboard_cache (
    user_id,
    rank_position,
    xp_total,
    rank_name,
    period_type,
    period_start,
    period_end
  )
  SELECT
    pl.user_id,
    ROW_NUMBER() OVER (ORDER BY SUM(pl.points) DESC) as rank_position,
    SUM(pl.points) as xp_total,
    COALESCE(r.name, 'Explorer') as rank_name,
    'monthly' as period_type,
    v_month_start as period_start,
    CURRENT_DATE as period_end
  FROM points_log pl
  LEFT JOIN user_ranks ur ON ur.user_id = pl.user_id AND ur.current_rank = true
  LEFT JOIN ranks r ON r.id = ur.rank_id
  WHERE pl.created_at >= v_month_start
  AND pl.points > 0
  GROUP BY pl.user_id, r.name
  ORDER BY SUM(pl.points) DESC
  LIMIT 1000;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  RAISE NOTICE 'Monthly leaderboard refreshed: % rows', v_rows_inserted;

  RETURN v_rows_inserted;
END;
$function$;
