use crate::db::DBClient;
use crate::models::SatkerWorkPattern;
use async_trait::async_trait;
use chrono::{NaiveDate, NaiveTime};
use sqlx::Error;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct WorkPatternUpsert {
    pub effective_from: NaiveDate,

    pub mon_work: bool,
    pub tue_work: bool,
    pub wed_work: bool,
    pub thu_work: bool,
    pub fri_work: bool,
    pub sat_work: bool,
    pub sun_work: bool,

    pub work_start: NaiveTime,
    pub work_end: NaiveTime,
    pub half_day_end: Option<NaiveTime>,
}

#[async_trait]
pub trait WorkPatternRepo {
    async fn list_work_patterns(&self, satker_id: Uuid) -> Result<Vec<SatkerWorkPattern>, Error>;

    /// Insert or update (by unique key satker_id + effective_from)
    async fn upsert_work_pattern(
        &self,
        satker_id: Uuid,
        item: WorkPatternUpsert,
    ) -> Result<SatkerWorkPattern, Error>;

    async fn delete_work_pattern(
        &self,
        satker_id: Uuid,
        effective_from: NaiveDate,
    ) -> Result<u64, Error>;
}

#[async_trait]
impl WorkPatternRepo for DBClient {
    async fn list_work_patterns(&self, satker_id: Uuid) -> Result<Vec<SatkerWorkPattern>, Error> {
        let rows = sqlx::query_as!(
            SatkerWorkPattern,
            r#"
            SELECT
              id,
              satker_id,
              effective_from,
              mon_work,
              tue_work,
              wed_work,
              thu_work,
              fri_work,
              sat_work,
              sun_work,
              work_start,
              work_end,
              half_day_end,
              created_at
            FROM satker_work_patterns
            WHERE satker_id = $1
            ORDER BY effective_from ASC
            "#,
            satker_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn upsert_work_pattern(
        &self,
        satker_id: Uuid,
        item: WorkPatternUpsert,
    ) -> Result<SatkerWorkPattern, Error> {
        let row = sqlx::query_as!(
            SatkerWorkPattern,
            r#"
            INSERT INTO satker_work_patterns (
              satker_id,
              effective_from,
              mon_work,
              tue_work,
              wed_work,
              thu_work,
              fri_work,
              sat_work,
              sun_work,
              work_start,
              work_end,
              half_day_end
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (satker_id, effective_from) DO UPDATE SET
              mon_work = EXCLUDED.mon_work,
              tue_work = EXCLUDED.tue_work,
              wed_work = EXCLUDED.wed_work,
              thu_work = EXCLUDED.thu_work,
              fri_work = EXCLUDED.fri_work,
              sat_work = EXCLUDED.sat_work,
              sun_work = EXCLUDED.sun_work,
              work_start = EXCLUDED.work_start,
              work_end = EXCLUDED.work_end,
              half_day_end = EXCLUDED.half_day_end
            RETURNING
              id,
              satker_id,
              effective_from,
              mon_work,
              tue_work,
              wed_work,
              thu_work,
              fri_work,
              sat_work,
              sun_work,
              work_start,
              work_end,
              half_day_end,
              created_at
            "#,
            satker_id,
            item.effective_from,
            item.mon_work,
            item.tue_work,
            item.wed_work,
            item.thu_work,
            item.fri_work,
            item.sat_work,
            item.sun_work,
            item.work_start,
            item.work_end,
            item.half_day_end
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    async fn delete_work_pattern(
        &self,
        satker_id: Uuid,
        effective_from: NaiveDate,
    ) -> Result<u64, Error> {
        let res = sqlx::query!(
            r#"DELETE FROM satker_work_patterns WHERE satker_id = $1 AND effective_from = $2"#,
            satker_id,
            effective_from
        )
        .execute(&self.pool)
        .await?;

        Ok(res.rows_affected())
    }
}

/// Utility: pick effective pattern by date.
/// Assumes patterns are sorted ASC by effective_from.
pub fn pick_effective_pattern(
    patterns: &[SatkerWorkPattern],
    date: NaiveDate,
) -> Option<SatkerWorkPattern> {
    let mut current: Option<SatkerWorkPattern> = None;
    for p in patterns {
        if p.effective_from <= date {
            current = Some(p.clone());
        } else {
            break;
        }
    }
    current
}
