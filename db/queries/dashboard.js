module.exports = {
  stats: `SELECT (SELECT count(*)::int FROM found_items WHERE status='AVAILABLE') AS available,(SELECT count(*)::int FROM found_items WHERE status='RETURNED') AS returned,(SELECT count(*)::int FROM lost_items WHERE status='OPEN') AS open_reports,(SELECT count(*)::int FROM found_items WHERE status='RETURNED' AND returned_at>=date_trunc('month',NOW())) AS returned_this_month`,
  recent: `SELECT found_id,item_name,category_name,building,found_date,colour_name,status FROM v_public_found_items WHERE status='AVAILABLE' ORDER BY created_at DESC LIMIT 6`,
  analytics: `SELECT cat.category_name,count(*)::int AS reported,count(*) FILTER(WHERE f.status='RETURNED')::int AS returned FROM found_items f JOIN categories cat USING(category_id) GROUP BY cat.category_name ORDER BY reported DESC`,
  hotspots: `SELECT l.building,count(*)::int AS reports,dense_rank() OVER(ORDER BY count(*) DESC)::int AS rank FROM lost_items i JOIN locations l USING(location_id) GROUP BY l.building ORDER BY reports DESC LIMIT 10`,
  ageing: `SELECT f.found_id,f.item_name,f.status,f.custody,f.storage_location,f.found_date,CURRENT_DATE-f.found_date AS days_held FROM found_items f WHERE f.status='AVAILABLE' AND f.found_date<CURRENT_DATE-30 ORDER BY f.found_date LIMIT 100`,
  flags: `SELECT user_id,full_name,flagged_count FROM users WHERE flagged_count>=3 ORDER BY flagged_count DESC LIMIT 100`,
};
