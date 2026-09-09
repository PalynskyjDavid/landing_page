CREATE INDEX scores_leaderboard_order_idx
ON scores (average_ms ASC, missclicks ASC, created_at ASC, id ASC);

---- create above / drop below ----

DROP INDEX scores_leaderboard_order_idx;
