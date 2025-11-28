const { getAllServices } = require('../repositories/servicesRepository');
const { sendJson } = require('../utils/response');

async function handleServices(_req, res) {
  try {
    const services = await getAllServices();
    return sendJson(res, 200, { services });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Unable to load services.' });
  }
}

module.exports = { handleServices };
