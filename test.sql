-- Test ClickHouse SQL file for syntax highlighting

CREATE TABLE IF NOT EXISTS events (
    event_id UInt64,
    user_id UInt64,
    event_name String,
    event_time DateTime,
    properties Map(String, String),
    tags Array(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (user_id, event_time)
PRIMARY KEY (user_id)
SETTINGS index_granularity = 8192;

-- Test function calls and expressions
SELECT
    count() AS total,
    sum(event_id) AS sum_ids,
    toDate(event_time) AS event_date
FROM events
WHERE event_name LIKE 'click%'
  AND event_time >= now() - INTERVAL 7 DAY
GROUP BY event_date
ORDER BY event_date DESC;
