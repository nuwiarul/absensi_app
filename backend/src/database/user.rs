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
        nrp: Option<String>,
        full_name: Option<String>,
        email: Option<String>,
        phone: Option<String>,
    ) -> Result<(), Error>;

    async fn delete_user(&self, id: Uuid) -> Result<(), Error>;

    async fn set_satker_head(&self, id: Uuid) -> Result<(), Error>;

    async fn get_satker_head(&self, satker_id: Uuid) -> Result<Option<User>, Error>;
}

#[async_trait]
impl UserRepo for DBClient {
    async fn find_user_by_id(&self, id: Uuid) -> Result<Option<User>, Error> {
        let row = sqlx::query_as!(
            User,
            r#"
            SELECT
            id, satker_id, nrp, full_name, email, phone, role as "role: UserRole",
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
            id, satker_id, nrp, full_name, email, phone, role as "role: UserRole",
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
            id, satker_id, nrp, full_name, email, phone, role as "role: UserRole",
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
            INSERT INTO users (satker_id, nrp, full_name, email, phone, role, password_hash)
            VALUES ($1, $2, $3, $4, $5, $6::user_role, $7)
            RETURNING id, satker_id, nrp, full_name, email, phone, role as "role: UserRole",
            password_hash, is_active, face_template_version, face_template_hash, created_at, updated_at
            "#,
            satker_id,
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
            SELECT id, satker_id, nrp, full_name, email, phone, role as "role: UserRole",
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
            SELECT id, satker_id, nrp, full_name, email, phone, role as "role: UserRole",
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
        nrp: Option<String>,
        full_name: Option<String>,
        email: Option<String>,
        phone: Option<String>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            UPDATE users
            SET satker_id = COALESCE($2, satker_id),
                nrp = COALESCE($3, nrp),
                full_name = COALESCE($4, full_name),
                email = COALESCE($5, email),
                phone = COALESCE($6, phone),
                updated_at = NOW()
            WHERE id = $1
            "#,
            id,
            satker_id,
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

    async fn get_satker_head(&self, satker_id: Uuid) -> Result<Option<User>, Error> {
        let row = sqlx::query_as!(
            User,
            r#"
            SELECT
            id, satker_id, nrp, full_name, email, phone, role as "role: UserRole",
            password_hash, is_active, face_template_version, face_template_hash, created_at, updated_at
            FROM users WHERE satker_id = $1 AND role= 'SATKER_HEAD'
            "#,
            satker_id
        ).fetch_optional(&self.pool)
            .await?;
        Ok(row)
    }
}
