const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');

const OUTBOX_DIR = path.join(DATA_DIR, 'receipt-outbox');

function ensureOutbox() {
  if (!fs.existsSync(OUTBOX_DIR)) {
    fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  }
}

function queueReceiptEmail(appointment) {
  ensureOutbox();
  const payload = {
    to: appointment.email,
    subject: `Receipt for appointment #${appointment.id}`,
    queuedAt: new Date().toISOString(),
    appointment
  };
  const filePath = path.join(OUTBOX_DIR, `appointment-${appointment.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

module.exports = {
  queueReceiptEmail
};
