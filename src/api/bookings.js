const { getServicesByIds } = require('../repositories/servicesRepository');
const { slotAvailable, createAppointment } = require('../repositories/appointmentsRepository');
const { applyPromoCode } = require('../utils/promo');
const { sendJson } = require('../utils/response');
const { parseBody } = require('../utils/body');

async function handleBookings(req, res) {
  try {
    const body = await parseBody(req);
    const {
      services: selectedServices = [],
      date,
      time,
      firstName,
      lastName,
      email,
      phone,
      postcode,
      note,
      cancellationAgreed,
      payment,
      promoCode
    } = body;

    if (!Array.isArray(selectedServices) || selectedServices.length === 0) {
      return sendJson(res, 400, { error: 'Please select at least one service.' });
    }
    if (!date || !time) {
      return sendJson(res, 400, { error: 'Please choose a date and time.' });
    }
    if (!(await slotAvailable(date, time))) {
      return sendJson(res, 409, { error: 'That time has just been booked. Please choose another slot.' });
    }
    if (!firstName || !lastName || !email || !phone || !postcode) {
      return sendJson(res, 400, { error: 'Please complete your personal details.' });
    }
    if (!cancellationAgreed) {
      return sendJson(res, 400, { error: 'Please acknowledge the cancellation policy.' });
    }
    if (!payment || !payment.cardNumber || !payment.expiry || !payment.cvc) {
      return sendJson(res, 400, { error: 'Payment details are required.' });
    }

    const chosen = await getServicesByIds(selectedServices);
    if (chosen.length === 0 || chosen.length !== selectedServices.length) {
      return sendJson(res, 400, { error: 'Selected services are not valid.' });
    }

    const subtotal = chosen.reduce((sum, service) => sum + service.price, 0);
    const tax = subtotal * 0.1;
    const { code: appliedCode, discount } = applyPromoCode(promoCode, subtotal + tax);
    const total = Math.max(0, subtotal + tax - discount);

    try {
      const result = await createAppointment({
        date,
        time,
        services: chosen,
        subtotal,
        tax,
        discount,
        total,
        promoCode: appliedCode,
        firstName,
        lastName,
        email,
        phone,
        postcode,
        note,
        cancellationAgreed
      });

      const appointment = {
        id: result.lastID,
        date,
        time,
        services: chosen,
        subtotal,
        tax,
        discount,
        total,
        promoCode: appliedCode,
        firstName,
        lastName,
        email,
        phone,
        postcode,
        note: note || '',
        cancellationAgreed: Boolean(cancellationAgreed),
        createdAt: new Date().toISOString()
      };

      return sendJson(res, 201, {
        message: 'Appointment confirmed',
        appointment
      });
    } catch (err) {
      if (err && err.code === 'SQLITE_CONSTRAINT') {
        return sendJson(res, 409, { error: 'That time has just been booked. Please choose another slot.' });
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Could not process booking. Please try again.' });
  }
}

module.exports = { handleBookings };
