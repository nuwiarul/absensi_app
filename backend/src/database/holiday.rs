use crate::constants::{HolidayKind, HolidayScope};
use crate::db::DBClient;
use crate::models::Holiday;
use async_trait::async_trait;
use chrono::{NaiveDate, NaiveTime};
use sqlx::Error;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct HolidayUpsertItem {
    pub holiday_date: NaiveDate,
    pub kind: HolidayKind,
    pub name: String,
    pub half_day_end: Option<NaiveTime>,
}

#[async_trait]
pub trait HolidayRepo {
    async fn list_holidays(
        &self,
        satker_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<Holiday>, Error>;

    async fn bulk_upsert_holidays(
        &self,
        scope: HolidayScope,
        satker_id: Option<Uuid>,
        items: Vec<HolidayUpsertItem>,
    ) -> Result<i64, Error>;
}

#[async_trait]
impl HolidayRepo for DBClient {
    async fn list_holidays(
        &self,
        satker_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<Holiday>, Error> {
        let rows = sqlx::query_as!(
            Holiday,
            r#"
            SELECT
              id,
              scope as "scope: HolidayScope",
              satker_id,
              holiday_date,
              kind as "kind: HolidayKind",
              name,
              half_day_end
            FROM holidays
            WHERE holiday_date BETWEEN $1 AND $2
              AND (
                scope = 'NATIONAL'
                OR (scope = 'SATKER' AND satker_id = $3)
              )
            ORDER BY holiday_date ASC
            "#,
            from,
            to,
            satker_id
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(rows)
    }

    async fn bulk_upsert_holidays(
        &self,
        scope: HolidayScope,
        satker_id: Option<Uuid>,
        items: Vec<HolidayUpsertItem>,
    ) -> Result<i64, Error> {
        let mut tx = self.pool.begin().await?;
        let mut total: i64 = 0;

        for item in items {
            let res = sqlx::query!(
                r#"
                INSERT INTO holidays (scope, satker_id, holiday_date, kind, name, half_day_end)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (scope, satker_id, holiday_date)
                DO UPDATE SET
                  kind = EXCLUDED.kind,
                  name = EXCLUDED.name,
                  half_day_end = EXCLUDED.half_day_end
                "#,
                scope as HolidayScope,
                satker_id,
                item.holiday_date,
                item.kind as HolidayKind,
                item.name,
                item.half_day_end,
            )
                .execute(&mut *tx)
                .await?;

            total += res.rows_affected() as i64;
        }

        tx.commit().await?;
        Ok(total)
    }
}
