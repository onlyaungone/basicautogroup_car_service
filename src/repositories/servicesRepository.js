const { all } = require('../database');

async function getAllServices() {
  return all('SELECT * FROM services ORDER BY id');
}

async function getServicesByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return all(`SELECT * FROM services WHERE id IN (${placeholders})`, ids);
}

module.exports = {
  getAllServices,
  getServicesByIds
};
