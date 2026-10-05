# Expiry Job Design (T3.13)

## Objective
The expiry job is a scheduled background process responsible for enforcing the system's expiration policy for unclaimed items and unresolved lost reports. 

## Process Overview
The job will run periodically (e.g. daily at midnight) and execute a single database transaction. 
The transaction will:
1. Identify all `found_items` where `status = 'AVAILABLE'` and `found_date` is older than 90 days.
2. Identify all `lost_items` where `status = 'OPEN'` and `lost_date` is older than 90 days.
3. Update the identified `found_items` status to `EXPIRED`.
4. Update the identified `lost_items` status to `EXPIRED`.
5. Identify all claims with `status = 'PENDING'` attached to matches whose corresponding items are now expired, and update them to `REJECTED` with a note `"Item expired"`.
6. Insert audit log records for each status change (FOUND_ITEM to EXPIRED, LOST_ITEM to EXPIRED, CLAIM to REJECTED) with the `changed_by` field set to a SYSTEM user identifier.

## Concurrency and Lock Order
Just like standard operations, to prevent deadlocks:
The process must `SELECT ... FOR UPDATE` rows in the fixed lock order: `found_items` -> `claims` -> `lost_items` -> `matches` -> `audit_log`.

## Storage
Expired found items are removed from circulation and will be sent to charity/disposal by the physical administration office. This state transition removes them from matching queries (which only probe `AVAILABLE` items).
