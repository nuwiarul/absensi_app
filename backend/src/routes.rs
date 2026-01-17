use crate::AppState;
use crate::handler::attendance::attendance_handler;
use crate::handler::attendance_challenge::attendance_challenge_handler;
use crate::handler::auth::auth_handler;
use crate::handler::geofence::geofence_handler;
use crate::handler::leave_request::leave_request_handler;
use crate::handler::satker::satker_handler;
use crate::handler::satker_head::satker_head_handler;
use crate::handler::user::user_handler;
use crate::middleware::auth_middleware::auth_middleware;
use axum::routing::get;
use axum::{Extension, Router, middleware};
use std::sync::Arc;
use tower_http::trace::TraceLayer;
use crate::handler::files::files_handler;
use crate::handler::schedule::schedule_handler;
use crate::handler::upload::uploads_handler;

async fn health() -> &'static str {
    "ok"
}

pub fn create_router(app_state: Arc<AppState>) -> Router {
    let api_router = Router::new()
        .nest("/auth", auth_handler())
        .nest(
            "/users",
            user_handler().layer(middleware::from_fn(auth_middleware)),
        )
        .nest(
            "/satkers",
            satker_handler().layer(middleware::from_fn(auth_middleware)),
        )
        .nest(
            "/satkers-head",
            satker_head_handler().layer(middleware::from_fn(auth_middleware)),
        )
        .nest(
            "/leave-requests",
            leave_request_handler().layer(middleware::from_fn(auth_middleware)),
        )
        .nest(
            "/geofences",
            geofence_handler().layer(middleware::from_fn(auth_middleware)),
        )
        .nest(
            "/attendance-challenge",
            attendance_challenge_handler().layer(middleware::from_fn(auth_middleware)),
        )
        .nest(
            "/attendance",
            attendance_handler().layer(middleware::from_fn(auth_middleware)),
        )
        .nest(
            "/schedules",
            schedule_handler().layer(middleware::from_fn(auth_middleware)),
        )
        .nest(
            "/uploads",
            uploads_handler().layer(middleware::from_fn(auth_middleware)),
        )
        .nest(
            "/files",
            files_handler().layer(middleware::from_fn(auth_middleware)),
        )
        .route("/health", get(health))
        .layer(TraceLayer::new_for_http())
        .layer(Extension(app_state));

    Router::new().nest("/api", api_router)
}
