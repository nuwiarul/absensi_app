use crate::DBClient;
use crate::constants::{AttendanceEventType, AttendanceLeaveType};
use crate::models::{AttendanceEvent, Satker};
use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, Utc};
use sqlx::Error;
use uuid::Uuid;
use crate::dtos::attendance::AttendanceRekapDto;

pub struct AddAttendanceEvent {
    pub session_id: Uuid,
    pub satker_id: Uuid,
    pub user_id: Uuid,
    pub event_type: AttendanceEventType,
    pub now: DateTime<Utc>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub accuracy_meters: Option<f64>,
    pub geofence_id: Option<Uuid>,
    pub distance_to_fence_m: Option<f64>,
    pub selfie_object_key: Option<String>,
    pub liveness_score: Option<f64>,
    pub face_match_score: Option<f64>,

    // Metadata Perangkat
    pub device_id: Option<String>,
    pub client_version: Option<String>,
    pub device_model: Option<String>,
    pub android_version: Option<String>,
    pub app_build: Option<String>,

    pub server_challenge_id: Option<Uuid>,

    pub attendance_leave_type: AttendanceLeaveType,
    pub attendance_leave_notes: Option<String>,

}

#[async_trait]
pub trait AttendanceEventRepo {
    async fn add_attendance_event(&self, add_row: AddAttendanceEvent) -> Result<(), Error>;

    async fn find_attendance_event_by_session(
        &self,
        session_id: Uuid,
        event_type: AttendanceEventType,
    ) -> Result<Option<AttendanceEvent>, Error>;

    async fn find_attendance_by_user_work_date(
        &self,
        work_date: NaiveDate,
        user_id: Uuid,
    ) -> Result<Option<AttendanceRekapDto>, Error>;

    async fn list_attendance_by_user_from_to(
        &self,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<AttendanceRekapDto>, Error>;


}

#[async_trait]
impl AttendanceEventRepo for DBClient {
    async fn add_attendance_event(&self, add_row: AddAttendanceEvent) -> Result<(), Error> {
        sqlx::query!(
            r#"
            INSERT INTO attendance_events (
              session_id, satker_id, user_id, event_type, occurred_at,
              latitude, longitude, accuracy_meters,
              geofence_id, distance_to_fence_m,
              selfie_object_key, liveness_score, face_match_score,
              device_id, client_version, server_challenge_id,
              device_model, android_version, app_build,
              attendance_leave_type, attendance_leave_notes
            )
            VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8,
              $9, $10,
              $11, $12, $13,
              $14, $15, $16, $17, $18, $19,
              $20, $21
            )
        "#,
            add_row.session_id,
            add_row.satker_id,
            add_row.user_id,
            add_row.event_type as AttendanceEventType,
            add_row.now,
            add_row.latitude,
            add_row.longitude,
            add_row.accuracy_meters,
            add_row.geofence_id,
            add_row.distance_to_fence_m,
            add_row.selfie_object_key,
            add_row.liveness_score,
            add_row.face_match_score,
            add_row.device_id,
            add_row.client_version,
            add_row.server_challenge_id,
            add_row.device_model,
            add_row.android_version,
            add_row.app_build,
            add_row.attendance_leave_type as AttendanceLeaveType,
            add_row.attendance_leave_notes,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn find_attendance_event_by_session(
        &self,
        session_id: Uuid,
        event_type: AttendanceEventType,
    ) -> Result<Option<AttendanceEvent>, Error> {
        let row = sqlx::query_as!(
            AttendanceEvent,
            r#"
            SELECT
                id,
                session_id,
                satker_id,
                user_id,
                event_type AS "event_type: AttendanceEventType",
                occurred_at,
                latitude,
                longitude,
                accuracy_meters,
                geofence_id,
                distance_to_fence_m,
                selfie_object_key,
                liveness_score,
                face_match_score,
                device_id,
                client_version,
                server_challenge_id,
                created_at,
                device_model,
                android_version,
                app_build,
                attendance_leave_type AS "attendance_leave_type: AttendanceLeaveType",
                attendance_leave_notes
            FROM attendance_events
            WHERE session_id = $1 AND event_type = $2
            "#,
            session_id,
            event_type as AttendanceEventType,
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    async fn find_attendance_by_user_work_date(
        &self,
        work_date: NaiveDate,
        user_id: Uuid,
    ) -> Result<Option<AttendanceRekapDto>, Error> {
        let row = sqlx::query_as!(
            AttendanceRekapDto,
            r#"
            SELECT
                s.id AS session_id,
                s.work_date AS work_date,
                s.user_id AS user_id,
                u.full_name AS full_name,
                u.nrp AS nrp,
                st.name AS satker_name,
                st.code AS satker_code,
                s.check_in_at AS "check_in_at?",
                s.check_out_at AS "check_out_at?",
                ci.geofence_id AS "check_in_geofence_id?",
                co.geofence_id AS "check_out_geofence_id?",
                ci.distance_to_fence_m AS "check_in_distance_to_fence_m?",
                co.distance_to_fence_m AS "check_out_distance_to_fence_m?",
                gci.name AS "check_in_geofence_name?",
                gco.name AS "check_out_geofence_name?",
                ci.latitude AS "check_in_latitude?",
                ci.longitude AS "check_in_longitute?",
                co.latitude AS "check_out_latitude?",
                co.longitude AS "check_out_longitute?",
                ci.selfie_object_key AS "check_in_selfie_object_key?",
                co.selfie_object_key AS "check_out_selfie_object_key?",
                ci.accuracy_meters AS "check_in_accuracy_meters?",
                co.accuracy_meters AS "check_out_accuracy_meters?",
                ci.attendance_leave_type AS "check_in_attendance_leave_type?: AttendanceLeaveType",
                co.attendance_leave_type AS "check_out_attendance_leave_type?: AttendanceLeaveType",
                ci.attendance_leave_notes AS "check_in_attendance_leave_notes?",
                co.attendance_leave_notes AS "check_out_attendance_leave_notes?",
                ci.device_id AS "check_in_device_id?",
                co.device_id AS "check_out_device_id?",
                ci.device_model AS "check_in_device_model?",
                co.device_model AS "check_out_device_model?",
                ui.full_name AS "check_in_device_name?",
                uo.full_name AS "check_out_device_name?"
            FROM attendance_sessions s
            JOIN users u ON s.user_id=u.id
            JOIN satkers st ON s.satker_id=st.id
            LEFT JOIN attendance_events ci ON s.id=ci.session_id AND ci.event_type = 'CHECK_IN'
            LEFT JOIN attendance_events co ON s.id=co.session_id AND co.event_type = 'CHECK_OUT'
            LEFT JOIN geofences gci ON ci.geofence_id=gci.id
            LEFT JOIN geofences gco ON co.geofence_id=gco.id
            LEFT JOIN user_devices uci ON ci.device_id=uci.device_id
            LEFT JOIN user_devices uco ON co.device_id=uco.device_id
            LEFT JOIN users ui ON uci.user_id=ui.id
            LEFT JOIN users uo ON uco.user_id=uo.id
            WHERE s.work_date=$1 AND s.user_id=$2
            "#,
            work_date,
            user_id
        ).fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    async fn list_attendance_by_user_from_to(
        &self,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<AttendanceRekapDto>, Error> {
        let rows = sqlx::query_as!(
            AttendanceRekapDto,
            r#"
            SELECT
                s.id AS session_id,
                s.work_date AS work_date,
                s.user_id AS user_id,
                u.full_name AS full_name,
                u.nrp AS nrp,
                st.name AS satker_name,
                st.code AS satker_code,
                s.check_in_at AS "check_in_at?",
                s.check_out_at AS "check_out_at?",
                ci.geofence_id AS "check_in_geofence_id?",
                co.geofence_id AS "check_out_geofence_id?",
                ci.distance_to_fence_m AS "check_in_distance_to_fence_m?",
                co.distance_to_fence_m AS "check_out_distance_to_fence_m?",
                gci.name AS "check_in_geofence_name?",
                gco.name AS "check_out_geofence_name?",
                ci.latitude AS "check_in_latitude?",
                ci.longitude AS "check_in_longitute?",
                co.latitude AS "check_out_latitude?",
                co.longitude AS "check_out_longitute?",
                ci.selfie_object_key AS "check_in_selfie_object_key?",
                co.selfie_object_key AS "check_out_selfie_object_key?",
                ci.accuracy_meters AS "check_in_accuracy_meters?",
                co.accuracy_meters AS "check_out_accuracy_meters?",
                ci.attendance_leave_type AS "check_in_attendance_leave_type?: AttendanceLeaveType",
                co.attendance_leave_type AS "check_out_attendance_leave_type?: AttendanceLeaveType",
                ci.attendance_leave_notes AS "check_in_attendance_leave_notes?",
                co.attendance_leave_notes AS "check_out_attendance_leave_notes?",
                ci.device_id AS "check_in_device_id?",
                co.device_id AS "check_out_device_id?",
                ci.device_model AS "check_in_device_model?",
                co.device_model AS "check_out_device_model?",
                ui.full_name AS "check_in_device_name?",
                uo.full_name AS "check_out_device_name?"
            FROM attendance_sessions s
            JOIN users u ON s.user_id=u.id
            JOIN satkers st ON s.satker_id=st.id
            LEFT JOIN attendance_events ci ON s.id=ci.session_id AND ci.event_type = 'CHECK_IN'
            LEFT JOIN attendance_events co ON s.id=co.session_id AND co.event_type = 'CHECK_OUT'
            LEFT JOIN geofences gci ON ci.geofence_id=gci.id
            LEFT JOIN geofences gco ON co.geofence_id=gco.id
            LEFT JOIN user_devices uci ON ci.device_id=uci.device_id
            LEFT JOIN user_devices uco ON co.device_id=uco.device_id
            LEFT JOIN users ui ON uci.user_id=ui.id
            LEFT JOIN users uo ON uco.user_id=uo.id
            WHERE s.work_date >= $1 AND s.work_date <= $2 AND s.user_id=$3
            ORDER BY s.work_date DESC
            "#,
            from,
            to,
            user_id
        ).fetch_all(&self.pool)
            .await?;
        Ok(rows)
    }
}
