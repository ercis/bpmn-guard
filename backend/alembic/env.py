import os
from logging.config import fileConfig
from dotenv import load_dotenv
from app.db.base import Base
from app.db import *  # noqa: F401, F403 - Import all models from db/__init__.py
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# Load .env file directly
load_dotenv()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config
# Get database URL directly from environment
SYNC_DATABASE_URI = os.getenv("SYNC_DATABASE_URI", "")
# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel # noqa: ERA001 - Keep base setup
# target_metadata = mymodel.Base.metadata # noqa: ERA001 - Keep base setup

target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option") # noqa: ERA001 - Keep base setup
# ... etc.


def include_name(name, type_, parent_names):
    """
    Filter function to exclude specific tables from autogenerate.

    Excludes langchain tables (langchain_pg_collection, langchain_pg_embedding)
    from being detected as dropped tables during autogenerate.
    """
    if type_ == "table":
        # Ignore langchain tables - they are managed separately
        ignore_tables = {
            "langchain_pg_collection",
            "langchain_pg_embedding",
        }
        return name not in ignore_tables
    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    context.configure(
        url=SYNC_DATABASE_URI,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_name=include_name,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = SYNC_DATABASE_URI

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_name=include_name,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
