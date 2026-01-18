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

    /// Admin listing (web): can list NATIONAL only, SATKER only, or both.
    async fn list_holidays_admin(
        &self,
        scope: Option<HolidayScope>,
        satker_id: Option<Uuid>,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<Holiday>, Error>;

    async fn upsert_holiday(
        &self,
        scope: HolidayScope,
        satker_id: Option<Uuid>,
        item: HolidayUpsertItem,
    ) -> Result<(), Error>;

    async fn delete_holiday(
        &self,
        scope: HolidayScope,
        satker_id: Option<Uuid>,
        holiday_date: NaiveDate,
    ) -> Result<u64, Error>;

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

    async fn list_holidays_admin(
        &self,
        scope: Option<HolidayScope>,
        satker_id: Option<Uuid>,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<Holiday>, Error> {
        // NOTE: for NATIONAL, satker_id is null; for SATKER, satker_id is required.
        // When scope is None, return NATIONAL + SATKER (when satker_id provided).
        let rows = match scope {
            Some(HolidayScope::National) => {
                sqlx::query_as!(
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
                    WHERE scope = 'NATIONAL'
                      AND holiday_date BETWEEN $1 AND $2
                    ORDER BY holiday_date ASC
                    "#,
                    from,
                    to
                )
                    .fetch_all(&self.pool)
                    .await?
            }
            Some(HolidayScope::Satker) => {
                let sid = satker_id.ok_or(Error::RowNotFound)?;
                sqlx::query_as!(
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
                    WHERE scope = 'SATKER'
                      AND satker_id = $3
                      AND holiday_date BETWEEN $1 AND $2
                    ORDER BY holiday_date ASC
                    "#,
                    from,
                    to,
                    sid
                )
                    .fetch_all(&self.pool)
                    .await?
            }
            None => {
                // both
                match satker_id {
                    Some(sid) => {
                        sqlx::query_as!(
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
                            sid
                        )
                            .fetch_all(&self.pool)
                            .await?
                    }
                    None => {
                        sqlx::query_as!(
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
                            ORDER BY holiday_date ASC
                            "#,
                            from,
                            to
                        )
                            .fetch_all(&self.pool)
                            .await?
                    }
                }
            }
        };
        Ok(rows)
    }

    async fn upsert_holiday(
        &self,
        scope: HolidayScope,
        satker_id: Option<Uuid>,
        item: HolidayUpsertItem,
    ) -> Result<(), Error> {
        sqlx::query!(
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
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn delete_holiday(
        &self,
        scope: HolidayScope,
        satker_id: Option<Uuid>,
        holiday_date: NaiveDate,
    ) -> Result<u64, Error> {
        let res = sqlx::query!(
            r#"
            DELETE FROM holidays
            WHERE scope = $1
              AND satker_id IS NOT DISTINCT FROM $2
              AND holiday_date = $3
            "#,
            scope as HolidayScope,
            satker_id,
            holiday_date
        )
            .execute(&self.pool)
            .await?;
        Ok(res.rows_affected())
    }
}
