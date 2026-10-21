.PHONY: db-reset

# ローカルの Supabase の DB を作り直す（事前に supabase start が必要）
db-reset:
	supabase db reset
