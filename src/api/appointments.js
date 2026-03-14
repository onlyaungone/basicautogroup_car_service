const { sendJson } = require('../utils/response');
const { parseBody } = require('../utils/body');
const { getCurrentUser } = require('../utils/auth');
const {
  getAppointmentsForUser,
  getAppointmentForUser,
  cancelAppointment,
  rescheduleAppointment,
  slotAvailable
} = require('../repositories/appointmentsRepository');

function canManageAppointment(appointment) {
  const appointmentDate = new Date(`${appointment.date}T${appointment.time}:00`);
  return appointment.status === 'booked' && appointmentDate > new Date();
}

function lateChangeFee(appointment) {
  const appointmentDate = new Date(`${appointment.date}T${appointment.time}:00`);
  return appointmentDate.getTime() - Date.now() <= 24 * 60 * 60 * 1000 ? 50 : 0;
}

async function requireUser(req, res) {
  const user = await getCurrentUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Please sign in first.' });
    return null;
  }
  return user;
}

async function handleAppointmentsList(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const appointments = await getAppointmentsForUser({ userId: user.id, email: user.email });
  return sendJson(res, 200, { appointments });
}

async function handleAppointmentDetail(req, res, id) {
  const user = await requireUser(req, res);
  if (!user) return;
  const appointment = await getAppointmentForUser(id, { userId: user.id, email: user.email });
  if (!appointment) {
    return sendJson(res, 404, { error: 'Appointment not found.' });
  }
  return sendJson(res, 200, { appointment });
}

async function handleAppointmentCancel(req, res, id) {
  const user = await requireUser(req, res);
  if (!user) return;
  const appointment = await getAppointmentForUser(id, { userId: user.id, email: user.email });
  if (!appointment) {
    return sendJson(res, 404, { error: 'Appointment not found.' });
  }
  if (!canManageAppointment(appointment)) {
    return sendJson(res, 400, { error: 'This appointment can no longer be cancelled.' });
  }
  const fee = lateChangeFee(appointment);
  const updatedTotal = fee > 0 ? 50 : 0;
  await cancelAppointment(id, fee, updatedTotal);
  return sendJson(res, 200, { ok: true, lateChangeFee: fee, total: updatedTotal });
}

async function handleAppointmentReschedule(req, res, id) {
  const user = await requireUser(req, res);
  if (!user) return;
  const appointment = await getAppointmentForUser(id, { userId: user.id, email: user.email });
  if (!appointment) {
    return sendJson(res, 404, { error: 'Appointment not found.' });
  }
  if (!canManageAppointment(appointment)) {
    return sendJson(res, 400, { error: 'This appointment can no longer be updated.' });
  }

  const body = await parseBody(req);
  const { date, time, pickupDate, pickupTime } = body;
  if (!date || !time || !pickupDate || !pickupTime) {
    return sendJson(res, 400, { error: 'New drop-off and pick-up times are required.' });
  }
  const newDropOff = new Date(`${date}T${time}:00`);
  const newPickup = new Date(`${pickupDate}T${pickupTime}:00`);
  if (newDropOff <= new Date()) {
    return sendJson(res, 400, { error: 'The new appointment must be in the future.' });
  }
  if (newPickup <= newDropOff) {
    return sendJson(res, 400, { error: 'Pick-up must be after the selected drop-off time.' });
  }
  if (!(await slotAvailable(date, time, id))) {
    return sendJson(res, 409, { error: 'That time is no longer available.' });
  }

  await rescheduleAppointment(id, { date, time, pickupDate, pickupTime });
  const updated = await getAppointmentForUser(id, { userId: user.id, email: user.email });
  return sendJson(res, 200, { appointment: updated });
}

module.exports = {
  handleAppointmentsList,
  handleAppointmentDetail,
  handleAppointmentCancel,
  handleAppointmentReschedule
};
