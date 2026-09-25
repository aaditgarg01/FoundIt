#!/bin/bash
DB="${DATABASE_URL:-postgres://foundit_user:foundit_password@localhost:5432/foundit}"
psql "$DB" -f db/tests/negative_tests.sql
