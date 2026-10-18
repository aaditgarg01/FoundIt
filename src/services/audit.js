async function logAudit(client, params) {
  const {
    entity_type,
    entity_id,
    action,
    old_status = null,
    new_status = null,
    changed_by = null,
    detail = null,
  } = params;

  await client.query(
    `INSERT INTO audit_log (
      entity_type, entity_id, action, old_status, new_status, changed_by, detail
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entity_type,
      entity_id,
      action,
      old_status,
      new_status,
      changed_by,
      detail ? JSON.stringify(detail) : null,
    ],
  );
}

module.exports = {
  logAudit,
};
