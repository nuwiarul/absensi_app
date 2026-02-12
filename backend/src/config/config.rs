#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub redis_url: String,
    pub jwt_maxage: i64,
    pub port: u16,
}

impl Config {
    pub fn init() -> Self {
        //dotenv::dotenv().ok();

        let database_url =
            std::env::var("DATABASE_URL").expect("DATABASE_URL must be set in the environment");
        let redis_url =
            std::env::var("REDIS_URL").expect("REDIS_URL must be set in the environment");
        let jwt_secret =
            std::env::var("JWT_SECRET_KEY").expect("JWT_SECRET_KEY must be set in the environment");
        let jwt_maxage = std::env::var("JWT_MAXAGE")
            .map(|v| v.parse::<i64>().unwrap_or(3600))
            .unwrap_or(3600);
        let port = std::env::var("PORT")
            .map(|v| v.parse::<u16>().unwrap_or(8000))
            .unwrap_or(8000);

        Config {
            database_url,
            redis_url,
            jwt_secret,
            jwt_maxage,
            port,
        }
    }
}
