const { getTimesForDate } = require('../repositories/appointmentsRepository');
const { generateTimeSlots } = require('../utils/timeSlots');
const { sendJson } = require('../utils/response');

async function handleAvailability(query, res) {
  const { date } = query;
  if (!date) {
    return sendJson(res, 400, { error: 'Date is required' });
  }
  try {
    const taken = await getTimesForDate(date);
    const takenSet = new Set(taken.map(row => row.time));
    const slots = generateTimeSlots().map(slot => ({
      ...slot,
      available: !takenSet.has(slot.time)
    }));
    return sendJson(res, 200, { date, slots });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Could not load availability.' });
  }
}

module.exports = { handleAvailability };
