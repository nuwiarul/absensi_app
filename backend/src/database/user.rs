use crate::auth::rbac::UserRole;
use crate::db::DBClient;
use crate::models::User;
use async_trait::async_trait;
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait UserRepo {
    async fn find_user_by_id(&self, id: Uuid) -> Result<Option<User>, Error>;
    async fn find_user_by_nrp(&self, nrp: String) -> Result<Option<User>, Error>;

    async fn find_user_by_satker(&self, id: Uuid, satker_id: Uuid) -> Result<Option<User>, Error>;

    async fn get_user_all(&self) -> Result<Vec<User>, Error>;

    async fn get_user_by_satker_id(&self, satker_id: Uuid) -> Result<Vec<User>, Error>;
    async fn create_user(
        &self,
        satker_id: Uuid,
        rank_id: Option<Uuid>,
        nrp: String,
        full_name: String,
        email: Option<String>,
        phone: Option<String>,
        role: UserRole,
        password: String,
    ) -> Result<User, Error>;

    async fn update_user(
        &self,
        id: Uuid,
        satker_id: Option<Uuid>,
        rank_id: Option<Uuid>,
        nrp: Option<String>,
        full_name: Option<String>,
        email: Option<String>,
        phone: Option<String>,
    ) -> Result<(), Error>;

    async fn update_my_profile(
        &self,
        id: Uuid,
        full_name: String,
        phone: Option<String>,
    ) -> Result<(), Error>;

    async fn update_password_hash(&self, id: Uuid, password_hash: String) -> Result<(), Error>;

    async fn update_profile_photo_key(
        &self,
        id: Uuid,
        profile_photo_key: Option<String>,
    ) -> Result<(), Error>;

    async fn delete_user(&self, id: Uuid) -> Result<(), Error>;

    async fn set_satker_head(&self, id: Uuid) -> Result<(), Error>;
}

#[async_trait]
impl UserRepo for DBClient {
    async fn find_user_by_id(&self, id: Uuid) -> Result<Option<User>, Error> {
        let row = sqlx::query_as!(
            User,
            r#"
            SELECT
            id, satker_id, rank_id, nrp, full_name, email, phone, profile_photo_key, role as "role: UserRole",
            password_hash, is_active, face_template_version, face_template_hash, created_at, updated_at
            FROM users WHERE id = $1
            "#,
            id
        ).fetch_optional(&self.pool)
            .await?;
        Ok(row)
    }

    async fn find_user_by_nrp(&self, nrp: String) -> Result<Option<User>, Error> {
        let row = sqlx::query_as!(
            User,
            r#"
            SELECT
            id, satker_id, rank_id, nrp, full_name, email, phone, profile_photo_key, role as "role: UserRole",
            password_hash, is_active, face_template_version, face_template_hash, created_at, updated_at
            FROM users WHERE nrp = $1
            "#,
            nrp
        ).fetch_optional(&self.pool)
            .await?;
        Ok(row)
    }

    async fn find_user_by_satker(&self, id: Uuid, satker_id: Uuid) -> Result<Option<User>, Error> {
        let row = sqlx::query_as!(
            User,
            r#"
            SELECT
            id, satker_id, rank_id, nrp, full_name, email, phone, profile_photo_key, role as "role: UserRole",
            password_hash, is_active, face_template_version, face_template_hash, created_at, updated_at
            FROM users WHERE id = $1 AND satker_id = $2 AND is_active = true
            "#,
            id,
            satker_id,
        ).fetch_optional(&self.pool)
            .await?;
        Ok(row)
    }

    async fn create_user(
        &self,
        satker_id: Uuid,
        rank_id: Option<Uuid>,
        nrp: String,
        full_name: String,
        email: Option<String>,
        phone: Option<String>,
        role: UserRole,
        password: String,
    ) -> Result<User, Error> {
        let row = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (satker_id, rank_id, nrp, full_name, email, phone, profile_photo_key, role, password_hash)
            VALUES ($1, $2, $3, $4, $5, $6, NULL, $7::user_role, $8)
            RETURNING id, satker_id, rank_id, nrp, full_name, email, phone, profile_photo_key, role as "role: UserRole",
            password_hash, is_active, face_template_version, face_template_hash, created_at, updated_at
            "#,
            satker_id,
            rank_id,
            nrp,
            full_name,
            email,
            phone,
            role as UserRole,
            password
        )
            .fetch_one(&self.pool)
            .await?;
        Ok(row)
    }

    async fn get_user_all(&self) -> Result<Vec<User>, Error> {
        let rows = sqlx::query_as!(
            User,
            r#"
            SELECT id, satker_id, rank_id, nrp, full_name, email, phone, profile_photo_key, role as "role: UserRole",
            password_hash, is_active, face_template_version, face_template_hash, created_at, updated_at
            FROM users
            "#
        ).fetch_all(&self.pool).await?;
        Ok(rows)
    }

    async fn get_user_by_satker_id(&self, satker_id: Uuid) -> Result<Vec<User>, Error> {
        let rows = sqlx::query_as!(
            User,
            r#"
            SELECT id, satker_id, rank_id, nrp, full_name, email, phone, profile_photo_key, role as "role: UserRole",
            password_hash, is_active, face_template_version, face_template_hash, created_at, updated_at
            FROM users
            WHERE satker_id = $1
            "#,
            satker_id
        ).fetch_all(&self.pool).await?;
        Ok(rows)
    }

    async fn update_user(
        &self,
        id: Uuid,
        satker_id: Option<Uuid>,
        rank_id: Option<Uuid>,
        nrp: Option<String>,
        full_name: Option<String>,
        email: Option<String>,
        phone: Option<String>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            UPDATE users
            SET satker_id = COALESCE($2, satker_id),
                rank_id = COALESCE($3, rank_id),
                nrp = COALESCE($4, nrp),
                full_name = COALESCE($5, full_name),
                email = COALESCE($6, email),
                phone = COALESCE($7, phone),
                updated_at = NOW()
            WHERE id = $1
            "#,
            id,
            satker_id,
            rank_id,
            nrp,
            full_name,
            email,
            phone,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn delete_user(&self, id: Uuid) -> Result<(), Error> {
        sqlx::query!(
            r#"
            DELETE FROM users WHERE id = $1
            "#,
            id
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn set_satker_head(&self, id: Uuid) -> Result<(), Error> {
        sqlx::query!(r#"UPDATE users SET role = 'SATKER_HEAD' WHERE id = $1"#, id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn update_my_profile(
        &self,
        id: Uuid,
        full_name: String,
        phone: Option<String>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            UPDATE users
            SET full_name = $2,
                phone = $3,
                updated_at = NOW()
            WHERE id = $1
            "#,
            id,
            full_name,
            phone,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn update_password_hash(&self, id: Uuid, password_hash: String) -> Result<(), Error> {
        sqlx::query!(
            r#"
            UPDATE users
            SET password_hash = $2,
                updated_at = NOW()
            WHERE id = $1
            "#,
            id,
            password_hash,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn update_profile_photo_key(
        &self,
        id: Uuid,
        profile_photo_key: Option<String>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            UPDATE users
            SET profile_photo_key = $2,
                updated_at = NOW()
            WHERE id = $1
            "#,
            id,
            profile_photo_key,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
