use crate::database::rank::RankRepo;
use crate::database::satker::SatkerRepo;
use crate::db::DBClient;
use crate::error::HttpError;
use crate::models::{Rank, Satker};

/// Fetches the shared catalog data that many handlers use for DTO construction.
pub async fn load_satkers_and_ranks(
    db_client: &DBClient,
) -> Result<(Vec<Satker>, Vec<Rank>), HttpError> {
    let satkers = db_client
        .get_satker_all()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let ranks = db_client
        .list_ranks()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok((satkers, ranks))
}
