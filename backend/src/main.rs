use std::path::PathBuf;
use std::sync::Arc;
use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use axum::http::Method;
use redis::aio::ConnectionManager;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::CorsLayer;
use tracing_subscriber::filter::LevelFilter;
use crate::config::config::Config;
use crate::db::DBClient;
use crate::routes::create_router;

mod error;
mod utils;
mod config;
mod db;
mod auth;
mod routes;
mod models;
mod database;
mod dtos;
mod handler;
mod middleware;
mod constants;

#[derive(Clone)]
pub struct AppState {
    pub env: Config,
    pub db_client: DBClient,
    pub redis_client: ConnectionManager,
    pub upload_dir: PathBuf,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_max_level(LevelFilter::DEBUG)
        .init();

    dotenv::dotenv().ok();

    let config = Config::init();

    let pool = match PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
    {
        Ok(pool) => {
            println!("Successfully connected to database");
            pool
        },
        Err(err) => {
            println!("Failed to connect database : {}", err);
            std::process::exit(1);
        }
    };

    let redis_pool = match redis::Client::open(config.redis_url.clone()) {
        Ok(redis_pool) => redis_pool,
        Err(err) => {
            println!("Failed to connect redis : {}", err);
            std::process::exit(1);
        }
    };

    let redis_client = ConnectionManager::new(redis_pool).await.unwrap();

    let origins = [
        "http://localhost:5173".parse().unwrap(),
        "https://resta-pontianak.vinrul.my.id".parse().unwrap(),
    ];

    let cors = CorsLayer::new()
        .allow_origin(origins.clone())
        .allow_headers([AUTHORIZATION, ACCEPT, CONTENT_TYPE])
        .allow_credentials(true)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE]);

    let db_client = DBClient::new(pool);

    let app_state = AppState {
        env: config.clone(),
        db_client,
        redis_client,
        upload_dir: std::path::PathBuf::from("./uploads"),
    };

    let app = create_router(Arc::new(app_state.clone())).layer(cors.clone());

    println!("{}", format!("Server is running on http://localhost:{}", config.port));

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", config.port)).await.unwrap();

    axum::serve(listener, app).await.unwrap();

}
