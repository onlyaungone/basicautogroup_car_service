const { all, get, run } = require('../database');

async function getTimesForDate(date) {
  return all('SELECT time FROM appointments WHERE date = ?', [date]);
}

async function slotAvailable(date, time) {
  const existing = await get('SELECT id FROM appointments WHERE date = ? AND time = ?', [date, time]);
  return !existing;
}

async function createAppointment({
  date,
  time,
  services,
  subtotal,
  tax,
  discount,
  total,
  promoCode,
  firstName,
  lastName,
  email,
  phone,
  postcode,
  note,
  cancellationAgreed
}) {
  return run(
    `INSERT INTO appointments (date, time, services, subtotal, tax, discount, total, promoCode, firstName, lastName, email, phone, postcode, note, cancellationAgreed, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      date,
      time,
      JSON.stringify(services),
      subtotal,
      tax,
      discount,
      total,
      promoCode,
      firstName,
      lastName,
      email,
      phone,
      postcode,
      note || '',
      cancellationAgreed ? 1 : 0,
      new Date().toISOString()
    ]
  );
}

module.exports = {
  getTimesForDate,
  slotAvailable,
  createAppointment
};
