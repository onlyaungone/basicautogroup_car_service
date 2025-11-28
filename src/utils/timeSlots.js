function generateTimeSlots() {
  const slots = [];
  const morningTimes = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
  const afternoonTimes = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00'];

  morningTimes.forEach(time => slots.push({ time, period: 'morning' }));
  afternoonTimes.forEach(time => slots.push({ time, period: 'afternoon' }));
  return slots;
}

module.exports = { generateTimeSlots };
