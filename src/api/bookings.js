const { getServicesByIds } = require('../repositories/servicesRepository');
const { slotAvailable, createAppointment } = require('../repositories/appointmentsRepository');
const { applyPromoCode } = require('../utils/promo');
const { sendJson } = require('../utils/response');
const { parseBody } = require('../utils/body');
const { getCurrentUser } = require('../utils/auth');
const { queueReceiptEmail } = require('../services/receiptMailer');

async function handleBookings(req, res) {
  try {
    const user = await getCurrentUser(req);
    const body = await parseBody(req);
    const {
      services: selectedServices = [],
      date,
      time,
      pickupDate,
      pickupTime,
      firstName,
      lastName,
      email,
      phone,
      addressLine1,
      addressLine2,
      suburb,
      stateRegion,
      postcode,
      vehicle,
      note,
      cancellationAgreed,
      payment,
      promoCode
    } = body;

    const phoneDigits = String(phone || '').replace(/\D+/g, '');
    const cardDigits = String(payment && payment.cardNumber ? payment.cardNumber : '').replace(/\D+/g, '');
    const dropoffAt = date && time ? new Date(`${date}T${time}:00`) : null;
    const pickupAt = pickupDate && pickupTime ? new Date(`${pickupDate}T${pickupTime}:00`) : null;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const lastServiceAt = vehicle && vehicle.lastServiceDate ? new Date(`${vehicle.lastServiceDate}T00:00:00`) : null;

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
    if (!addressLine1 || !suburb || !stateRegion) {
      return sendJson(res, 400, { error: 'Please complete your address details.' });
    }
    if (!['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'].includes(String(stateRegion))) {
      return sendJson(res, 400, { error: 'Please select a valid Australian state or territory.' });
    }
    if (!vehicle || !vehicle.make || !vehicle.model || !vehicle.year || !vehicle.series || !vehicle.odometer || !vehicle.lastServiceDate || !vehicle.registration) {
      return sendJson(res, 400, { error: 'Please complete all vehicle information.' });
    }
    if (!/^[0-9]+$/.test(String(vehicle.year)) || !/^[0-9]+$/.test(String(vehicle.odometer))) {
      return sendJson(res, 400, { error: 'Year and odometer must contain numbers only.' });
    }
    if (Number.isNaN(lastServiceAt?.getTime()) || lastServiceAt >= todayStart) {
      return sendJson(res, 400, { error: 'Last service date must be before today.' });
    }
    if (!/^[0-9]{10}$/.test(phoneDigits)) {
      return sendJson(res, 400, { error: 'Please enter a valid 10 digit Australian phone number.' });
    }
    if (!/^[0-9]{4}$/.test(String(postcode || ''))) {
      return sendJson(res, 400, { error: 'Please enter a valid 4 digit Australian postcode.' });
    }
    if (!pickupDate || !pickupTime || Number.isNaN(pickupAt?.getTime())) {
      return sendJson(res, 400, { error: 'Please choose a valid pick-up date and time.' });
    }
    if (Number.isNaN(dropoffAt?.getTime()) || pickupAt.getTime() - dropoffAt.getTime() < 3 * 60 * 60 * 1000) {
      return sendJson(res, 400, { error: 'Pick-up must be at least 3 hours after drop-off.' });
    }
    if (!cancellationAgreed) {
      return sendJson(res, 400, { error: 'Please acknowledge the cancellation policy.' });
    }
    if (!payment || !payment.cardNumber || !payment.expiry || !payment.cvc) {
      return sendJson(res, 400, { error: 'Payment details are required.' });
    }
    if (!/^[0-9]{16}$/.test(cardDigits) || !/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(String(payment.expiry)) || !/^[0-9]{3,4}$/.test(String(payment.cvc))) {
      return sendJson(res, 400, { error: 'Please enter valid payment card details.' });
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
        userId: user ? user.id : null,
        date,
        time,
        pickupDate,
        pickupTime,
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
        addressLine1,
        addressLine2,
        suburb,
        stateRegion,
        postcode,
        vehicle,
        note,
        cancellationAgreed
      });

      const appointment = {
        id: result.lastID,
        userId: user ? user.id : null,
        date,
        time,
        pickupDate: pickupDate || '',
        pickupTime: pickupTime || '',
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
        addressLine1,
        addressLine2: addressLine2 || '',
        suburb,
        stateRegion,
        postcode,
        vehicle,
        note: note || '',
        cancellationAgreed: Boolean(cancellationAgreed),
        createdAt: new Date().toISOString()
      };

      const receiptPath = queueReceiptEmail(appointment);

      return sendJson(res, 201, {
        message: 'Appointment confirmed',
        appointment,
        receiptPath
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
