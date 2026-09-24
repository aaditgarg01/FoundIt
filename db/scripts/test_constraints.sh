#!/bin/bash
psql -h localhost -U foundit_user -d foundit -f db/tests/negative_tests.sql
