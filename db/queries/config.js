module.exports = {
  list: "SELECT * FROM match_config ORDER BY config_key",
  bands: "SELECT * FROM score_bands ORDER BY lower_bound",
  lock: "SELECT config_key FROM match_config ORDER BY config_key FOR UPDATE",
  update:
    "UPDATE match_config SET config_value=$2,version=version+1,updated_at=NOW() WHERE config_key=$1",
  setBand: `UPDATE score_bands SET lower_bound=$2,upper_bound=$3 WHERE band_name=$1`,
};
