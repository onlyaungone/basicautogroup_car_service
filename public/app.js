const serviceListEl = document.getElementById('serviceList');
const selectedServicesEl = document.getElementById('selectedServices');
const morningSlotsEl = document.getElementById('morningSlots');
const afternoonSlotsEl = document.getElementById('afternoonSlots');
const dateInput = document.getElementById('dateInput');
const checkoutForm = document.getElementById('checkoutForm');
const summaryServicesEl = document.getElementById('summaryServices');
const summarySubtotalEl = document.getElementById('summarySubtotal');
const summaryTaxEl = document.getElementById('summaryTax');
const summaryDiscountEl = document.getElementById('summaryDiscount');
const summaryTotalEl = document.getElementById('summaryTotal');
const summaryAppointmentEl = document.getElementById('summaryAppointment');
const policyFullEl = document.getElementById('policyFull');
const policyPreviewEl = document.getElementById('policyPreview');
const policyAgreeEl = document.getElementById('policyAgree');
const policyWarningEl = document.getElementById('policyWarning');
const promoInput = document.getElementById('promoInput');
const promoFeedback = document.getElementById('promoFeedback');
const formMessage = document.getElementById('formMessage');
const addNoteBtn = document.getElementById('addNote');
const noteInput = document.getElementById('noteInput');

let services = [];
let selectedServiceIds = [];
let selectedDate = '';
let selectedTime = '';
let appliedPromo = null;

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

async function fetchServices() {
  const res = await fetch('/api/services');
  const data = await res.json();
  services = data.services || [];
  renderServices();
}

function renderServices() {
  serviceListEl.innerHTML = '';
  services.forEach(service => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <h3>${service.name}</h3>
        <p>${service.description}</p>
      </div>
      <div class="price-row">
        <span class="price">${formatCurrency(service.price)}</span>
        <button class="btn ghost small" data-id="${service.id}">${selectedServiceIds.includes(service.id) ? 'Remove' : 'Add'}</button>
      </div>
    `;
    const btn = card.querySelector('button');
    btn.addEventListener('click', () => toggleService(service.id));
    serviceListEl.appendChild(card);
  });
  updateSelectedServices();
}

function toggleService(id) {
  if (selectedServiceIds.includes(id)) {
    selectedServiceIds = selectedServiceIds.filter(sid => sid !== id);
  } else {
    selectedServiceIds.push(id);
  }
  appliedPromo = null;
  promoFeedback.textContent = '';
  renderServices();
  updateSummary();
}

function updateSelectedServices() {
  selectedServicesEl.innerHTML = '';
  if (selectedServiceIds.length === 0) {
    selectedServicesEl.classList.add('empty');
    selectedServicesEl.textContent = 'No services selected yet.';
    return;
  }
  selectedServicesEl.classList.remove('empty');
  selectedServiceIds.forEach(id => {
    const service = services.find(s => s.id === id);
    if (!service) return;
    const row = document.createElement('div');
    row.className = 'selected-item';
    row.innerHTML = `<span>${service.name}</span><strong>${formatCurrency(service.price)}</strong>`;
    selectedServicesEl.appendChild(row);
  });
}

function updateSummary() {
  const selected = services.filter(s => selectedServiceIds.includes(s.id));
  summaryServicesEl.innerHTML = '';
  if (selected.length === 0) {
    summaryServicesEl.innerHTML = '<p class="hint">Add a service to view pricing.</p>';
  } else {
    selected.forEach(service => {
      const row = document.createElement('div');
      row.className = 'summary__row';
      row.innerHTML = `<span>${service.name}</span><strong>${formatCurrency(service.price)}</strong>`;
      summaryServicesEl.appendChild(row);
    });
  }
  const subtotal = selected.reduce((sum, s) => sum + s.price, 0);
  const tax = subtotal * 0.1;
  const discount = appliedPromo ? appliedPromo.discount : 0;
  const total = Math.max(0, subtotal + tax - discount);

  summarySubtotalEl.textContent = formatCurrency(subtotal);
  summaryTaxEl.textContent = formatCurrency(tax);
  summaryDiscountEl.textContent = `-${formatCurrency(discount)}`;
  summaryTotalEl.textContent = formatCurrency(total);

  if (selectedDate && selectedTime) {
    summaryAppointmentEl.textContent = `${selectedDate} at ${selectedTime}`;
  } else {
    summaryAppointmentEl.textContent = 'Select a date & time';
  }
}

async function fetchAvailability(date) {
  const res = await fetch(`/api/availability?date=${encodeURIComponent(date)}`);
  const data = await res.json();
  renderSlots(data.slots || []);
}

function renderSlots(slots) {
  morningSlotsEl.innerHTML = '';
  afternoonSlotsEl.innerHTML = '';
  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.className = 'slot';
    btn.textContent = slot.time;
    if (!slot.available) {
      btn.classList.add('unavailable');
      btn.disabled = true;
    }
    if (slot.time === selectedTime && selectedDate) {
      btn.classList.add('selected');
    }
    btn.addEventListener('click', () => {
      selectedTime = slot.time;
      renderSlots(slots);
      updateSummary();
    });
    if (slot.period === 'morning') {
      morningSlotsEl.appendChild(btn);
    } else {
      afternoonSlotsEl.appendChild(btn);
    }
  });
}

function setDefaultDate() {
  const today = new Date();
  const iso = today.toISOString().split('T')[0];
  dateInput.value = iso;
  selectedDate = iso;
  fetchAvailability(iso);
  updateSummary();
}

function togglePolicy() {
  policyFullEl.classList.toggle('show');
  policyPreviewEl.style.display = policyFullEl.classList.contains('show') ? 'none' : 'block';
}

document.getElementById('togglePolicy').addEventListener('click', togglePolicy);
dateInput.addEventListener('change', (e) => {
  selectedDate = e.target.value;
  selectedTime = '';
  fetchAvailability(selectedDate);
  updateSummary();
});

addNoteBtn.addEventListener('click', () => {
  noteInput.focus();
});

function applyPromoFromInput() {
  const code = promoInput.value.trim();
  if (!code) {
    appliedPromo = null;
    promoFeedback.textContent = 'Enter a code to apply a discount.';
    updateSummary();
    return;
  }
  const subtotal = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + s.price, 0);
  const tax = subtotal * 0.1;
  const rateMap = { SAVE10: 0.1, VIP15: 0.15, NEIGHBOUR5: 0.05 };
  const upper = code.toUpperCase();
  if (!rateMap[upper]) {
    appliedPromo = { code: upper, discount: 0 };
    promoFeedback.textContent = 'Code not recognised, no discount applied.';
  } else {
    appliedPromo = { code: upper, discount: (subtotal + tax) * rateMap[upper] };
    promoFeedback.textContent = `${upper} applied.`;
  }
  updateSummary();
}

document.getElementById('applyPromo').addEventListener('click', applyPromoFromInput);

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMessage.textContent = '';
  if (!policyAgreeEl.checked) {
    policyWarningEl.textContent = 'Please accept the cancellation policy to continue.';
    policyAgreeEl.focus();
    return;
  }
  policyWarningEl.textContent = '';
  if (!selectedDate || !selectedTime) {
    formMessage.textContent = 'Select a date and time to continue.';
    formMessage.style.color = '#c0392b';
    return;
  }
  const formData = new FormData(checkoutForm);
  const payload = {
    services: selectedServiceIds,
    date: selectedDate,
    time: selectedTime,
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    postcode: formData.get('postcode'),
    note: formData.get('note'),
    cancellationAgreed: policyAgreeEl.checked,
    payment: {
      cardNumber: formData.get('cardNumber'),
      expiry: formData.get('expiry'),
      cvc: formData.get('cvc')
    },
    promoCode: appliedPromo ? appliedPromo.code : formData.get('promo')
  };

  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    formMessage.textContent = data.error || 'Something went wrong.';
    formMessage.style.color = '#c0392b';
    return;
  }

  formMessage.textContent = 'Appointment confirmed! Check your email for details.';
  formMessage.style.color = '#0a7d39';
  appliedPromo = data.appointment.promoCode ? { code: data.appointment.promoCode, discount: data.appointment.discount } : null;
  selectedServiceIds = data.appointment.services.map(s => s.id);
  selectedTime = data.appointment.time;
  renderServices();
  updateSummary();
  fetchAvailability(selectedDate);
});

fetchServices();
setDefaultDate();
updateSummary();
