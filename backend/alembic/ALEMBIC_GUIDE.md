# Alembic Guide

## Prereqs

- Ensure your database connection is properly configured in `.env` file
- All models should be imported in `app/db/__init__.py` for Alembic to detect them

## Creating a Migration for BPMN Models Table

### Step 1: Generate the Migration

```bash
cd backend
uv run alembic revision --autogenerate -m "abc"
```

This will:
- Scan all models imported in `app/db/__init__.py`
- Compare them with the current database schema
- Generate a migration file in `alembic/versions/`

### Step 2: Review the Migration

The generated migration file will be in `alembic/versions/` with a name like:
```
<revision_id>_create_bpmn_models_table.py
```

Open this file and verify the migration

### Step 3: Apply the Migration

Run the migration to create the table:

```bash
uv alembic upgrade head
```

This applies all pending migrations to your database.

### Step 4: Verify the Migration

Check the current migration status:

```bash
uv alembic current
```

View migration history:

```bash
uv alembic history
```

## Common Alembic Commands

### Check Current Migration Version
```bash
uv alembic current
```

### View Migration History
```bash
uv alembic history --verbose
```

### Upgrade to Latest Migration
```bash
uv alembic upgrade head
```

### Upgrade One Step
```bash
uv alembic upgrade +1
```

### Downgrade One Step
```bash
uv alembic downgrade -1
```

### Downgrade to Specific Revision
```bash
uv alembic downgrade <revision_id>
```

### Downgrade All (Back to Empty Database)
```bash
uv alembic downgrade base
```

### Show SQL Without Executing
```bash
uv alembic upgrade head --sql
```

## Troubleshooting

### Models Not Detected

If your new model is not detected by autogenerate:

1. Ensure the model is imported in `app/db/__init__.py`
2. Ensure the model inherits from `BaseModel` (which inherits from `Base`)
3. Check that `__tablename__` is set in the model

### UUID Default Value Issue

If you see warnings about UUID defaults:

- The `default=uuid7()` in the model is evaluated at import time
- Alembic may not detect this correctly
- Consider using `server_default=text("gen_random_uuid()")` for PostgreSQL
- Or handle UUID generation at the application level

## Best Practices

1. **Always review auto-generated migrations** - Alembic may not detect everything correctly
2. **Test migrations on a development database first**
3. **Keep migrations in version control** - Never delete migration files
4. **One logical change per migration** - Makes rollback easier
5. **Add data migrations separately** - Don't mix schema and data changes
6. **Document complex migrations** - Add comments explaining why

## Next Steps After Migration

Once the `bpmn_models` table is created:

1. Create the API endpoints in `app/api/` directory
2. Create CRUD service functions in `app/services/`
3. Test the endpoints with the type-safe schemas from `app/schemas/bpmn_model.py`
4. Persist uploaded files via `app/utils/local_storage.py` (local-filesystem helper)

## Example: Future Model Changes

If you need to add a new field to BPMNModel later:

1. Update the model in `app/db/models/bpmn_model.py`
2. Run: `alembic revision --autogenerate -m "add field_name to bpmn_models"`
3. Review the generated migration
4. Run: `alembic upgrade head`
