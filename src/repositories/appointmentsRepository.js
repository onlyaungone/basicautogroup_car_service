const { all, get, run } = require('../database');

function mapAppointment(row) {
  if (!row) return null;
  return {
    ...row,
    services: row.services ? JSON.parse(row.services) : [],
    vehicle: row.vehicle ? JSON.parse(row.vehicle) : null,
    cancellationAgreed: Boolean(row.cancellationAgreed)
  };
}

async function getTimesForDate(date) {
  return all(`SELECT time FROM appointments WHERE date = ? AND status = 'booked'`, [date]);
}

async function slotAvailable(date, time, excludeId = null) {
  const params = [date, time];
  let sql = `SELECT id FROM appointments WHERE date = ? AND time = ? AND status = 'booked'`;
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  const existing = await get(sql, params);
  return !existing;
}

async function createAppointment(appointment) {
  return run(
    `INSERT INTO appointments (
      userId, date, time, pickupDate, pickupTime, services, subtotal, tax, discount, total, lateChangeFee,
      promoCode, firstName, lastName, email, phone, addressLine1, addressLine2, suburb, stateRegion, postcode,
      vehicle, note, status, cancellationAgreed, cancelledAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      appointment.userId || null,
      appointment.date,
      appointment.time,
      appointment.pickupDate || '',
      appointment.pickupTime || '',
      JSON.stringify(appointment.services),
      appointment.subtotal,
      appointment.tax,
      appointment.discount,
      appointment.total,
      appointment.lateChangeFee || 0,
      appointment.promoCode || null,
      appointment.firstName,
      appointment.lastName,
      appointment.email,
      appointment.phone,
      appointment.addressLine1 || '',
      appointment.addressLine2 || '',
      appointment.suburb || '',
      appointment.stateRegion || '',
      appointment.postcode,
      JSON.stringify(appointment.vehicle || null),
      appointment.note || '',
      appointment.status || 'booked',
      appointment.cancellationAgreed ? 1 : 0,
      appointment.cancelledAt || null,
      appointment.createdAt || new Date().toISOString(),
      appointment.updatedAt || new Date().toISOString()
    ]
  );
}

async function getAppointmentsForUser({ userId, email }) {
  const rows = await all(
    `SELECT * FROM appointments
     WHERE userId = ? OR email = ?
     ORDER BY date DESC, time DESC`,
    [userId || -1, email]
  );
  return rows.map(mapAppointment);
}

async function getAppointmentForUser(id, { userId, email }) {
  const row = await get(
    `SELECT * FROM appointments
     WHERE id = ? AND (userId = ? OR email = ?)`,
    [id, userId || -1, email]
  );
  return mapAppointment(row);
}

async function cancelAppointment(id, fee, total) {
  await run(
    `UPDATE appointments
     SET status = 'cancelled', lateChangeFee = ?, total = ?, cancelledAt = ?, updatedAt = ?
     WHERE id = ?`,
    [fee, total, new Date().toISOString(), new Date().toISOString(), id]
  );
}

async function rescheduleAppointment(id, changes) {
  await run(
    `UPDATE appointments
     SET date = ?, time = ?, pickupDate = ?, pickupTime = ?, updatedAt = ?
     WHERE id = ?`,
    [changes.date, changes.time, changes.pickupDate, changes.pickupTime, new Date().toISOString(), id]
  );
}

module.exports = {
  getTimesForDate,
  slotAvailable,
  createAppointment,
  getAppointmentsForUser,
  getAppointmentForUser,
  cancelAppointment,
  rescheduleAppointment
};
