module.exports = {
  register: `INSERT INTO users(email,password_hash,full_name,phone,department) VALUES($1,$2,$3,$4,$5) RETURNING user_id,email,full_name,role,phone,department`,
  byEmail: `SELECT * FROM users WHERE lower(email)=lower($1) AND is_active=true`,
  session: `INSERT INTO sessions(session_id,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '7 days')`,
  activeSession: `SELECT u.user_id,u.email,u.full_name,u.role,u.phone,u.department FROM users u JOIN sessions s USING(user_id) WHERE u.user_id=$1 AND s.session_id=$2 AND s.expires_at>NOW() AND u.is_active`,
  refresh: `SELECT u.user_id,u.email,u.role,s.session_id FROM sessions s JOIN users u USING(user_id) WHERE s.session_id=$1 AND s.expires_at>NOW() AND u.is_active`,
  logout: `DELETE FROM sessions WHERE session_id=$1 AND user_id=$2`,
  profile: `UPDATE users SET full_name=$1,phone=$2,department=$3,updated_at=NOW() WHERE user_id=$4 RETURNING user_id,email,full_name,role,phone,department`,
};
