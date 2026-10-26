.PHONY: db-reset db-test

LOCAL_DB_URL := postgresql://postgres:postgres@127.0.0.1:54322/postgres

# ローカルの Supabase の DB を作り直す（事前に supabase start が必要）
# sekirepo_api のパスワードはローカル専用の固定値（秘密ではない）
db-reset:
	supabase db reset
	psql "$(LOCAL_DB_URL)" -c "alter role sekirepo_api password 'local-only'"

# supabase/tests の pgTAP のテストを流す
db-test:
	supabase test db
