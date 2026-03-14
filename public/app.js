const STORAGE_KEY = 'basicauto-booking-state';

const state = loadState();
const page = document.body.dataset.page;

let services = [];

function defaultState() {
  return {
    selectedServiceIds: [],
    selectedDate: '',
    selectedTime: '',
    appliedPromo: null,
    customer: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      postcode: '',
      note: '',
      cardNumber: '',
      expiry: '',
      cvc: '',
      policyAgreed: false
    }
  };
}

function loadState() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultState();
  } catch (_error) {
    return defaultState();
  }
}

function saveState() {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

function getSelectedServices() {
  return services.filter(service => state.selectedServiceIds.includes(service.id));
}

function getPricing() {
  const subtotal = getSelectedServices().reduce((sum, service) => sum + service.price, 0);
  const tax = subtotal * 0.1;
  const discount = state.appliedPromo ? state.appliedPromo.discount : 0;
  const total = Math.max(0, subtotal + tax - discount);
  return { subtotal, tax, discount, total };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function renderSelectedServices(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const selected = getSelectedServices();
  container.innerHTML = '';

  if (selected.length === 0) {
    container.classList.add('empty');
    container.textContent = 'No services selected yet.';
    return;
  }

  container.classList.remove('empty');
  selected.forEach(service => {
    const row = document.createElement('div');
    row.className = 'selected-item';
    row.innerHTML = `<span>${service.name}</span><strong>${formatCurrency(service.price)}</strong>`;
    container.appendChild(row);
  });
}

function renderSummaryServices() {
  const container = document.getElementById('summaryServices');
  if (!container) return;

  const selected = getSelectedServices();
  container.innerHTML = '';

  if (selected.length === 0) {
    container.innerHTML = '<p class="hint">Add a service to view pricing.</p>';
    return;
  }

  selected.forEach(service => {
    const row = document.createElement('div');
    row.className = 'summary__row';
    row.innerHTML = `<span>${service.name}</span><strong>${formatCurrency(service.price)}</strong>`;
    container.appendChild(row);
  });
}

function renderPricing() {
  const pricing = getPricing();

  setText('summarySubtotal', formatCurrency(pricing.subtotal));
  setText('summaryTax', formatCurrency(pricing.tax));
  setText('summaryDiscount', `-${formatCurrency(pricing.discount)}`);
  setText('summaryTotal', formatCurrency(pricing.total));

  if (document.getElementById('summaryServices')) {
    renderSummaryServices();
  }

  const appointment = state.selectedDate && state.selectedTime
    ? `${state.selectedDate} at ${state.selectedTime}`
    : 'Select a date and time';
  setText('summaryAppointment', appointment);
}

function setButtonState(id, enabled) {
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.toggle('is-disabled', !enabled);
  el.setAttribute('aria-disabled', String(!enabled));
}

async function fetchServices() {
  const res = await fetch('/api/services');
  const data = await res.json();
  services = data.services || [];
}

async function fetchAvailability(date) {
  const res = await fetch(`/api/availability?date=${encodeURIComponent(date)}`);
  const data = await res.json();
  renderSlots(data.slots || []);
}

function toggleService(id) {
  if (state.selectedServiceIds.includes(id)) {
    state.selectedServiceIds = state.selectedServiceIds.filter(serviceId => serviceId !== id);
  } else {
    state.selectedServiceIds.push(id);
  }

  if (state.selectedServiceIds.length === 0) {
    state.selectedDate = '';
    state.selectedTime = '';
    state.appliedPromo = null;
  }

  saveState();
}

function renderServicesPage() {
  const serviceListEl = document.getElementById('serviceList');
  if (!serviceListEl) return;

  serviceListEl.innerHTML = '';
  services.forEach(service => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <h3>${service.name}</h3>
        <p>${service.description}</p>
      </div>
      <div class="price-row">
        <span class="price">${formatCurrency(service.price)}</span>
        <button class="btn ghost small" type="button" data-id="${service.id}">
          ${state.selectedServiceIds.includes(service.id) ? 'Remove' : 'Add'}
        </button>
      </div>
    `;

    card.querySelector('button').addEventListener('click', () => {
      toggleService(service.id);
      renderServicesPage();
      renderSelectedServices('selectedServices');
      renderPricing();
      setButtonState('continueToSchedule', state.selectedServiceIds.length > 0);
    });

    serviceListEl.appendChild(card);
  });

  renderSelectedServices('selectedServices');
  renderPricing();
  setButtonState('continueToSchedule', state.selectedServiceIds.length > 0);
}

function renderSlots(slots) {
  const morningSlotsEl = document.getElementById('morningSlots');
  const afternoonSlotsEl = document.getElementById('afternoonSlots');
  if (!morningSlotsEl || !afternoonSlotsEl) return;

  morningSlotsEl.innerHTML = '';
  afternoonSlotsEl.innerHTML = '';

  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot';
    btn.textContent = slot.time;

    if (!slot.available) {
      btn.classList.add('unavailable');
      btn.disabled = true;
    }

    if (slot.time === state.selectedTime && state.selectedDate) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', () => {
      state.selectedTime = slot.time;
      saveState();
      renderSlots(slots);
      renderPricing();
      setButtonState('continueToCheckout', Boolean(state.selectedDate && state.selectedTime));
    });

    if (slot.period === 'morning') {
      morningSlotsEl.appendChild(btn);
    } else {
      afternoonSlotsEl.appendChild(btn);
    }
  });
}

function ensureDate() {
  if (state.selectedDate) {
    return state.selectedDate;
  }

  const today = new Date();
  state.selectedDate = today.toISOString().split('T')[0];
  saveState();
  return state.selectedDate;
}

function renderSchedulePage() {
  if (state.selectedServiceIds.length === 0) {
    window.location.href = '/services.html';
    return;
  }

  renderSelectedServices('selectedServices');
  renderPricing();

  const dateInput = document.getElementById('dateInput');
  const date = ensureDate();
  dateInput.value = date;

  dateInput.addEventListener('change', event => {
    state.selectedDate = event.target.value;
    state.selectedTime = '';
    saveState();
    renderPricing();
    fetchAvailability(state.selectedDate);
    setButtonState('continueToCheckout', false);
  });

  fetchAvailability(date);
  setButtonState('continueToCheckout', Boolean(state.selectedDate && state.selectedTime));
}

function hydrateCheckoutForm() {
  const form = document.getElementById('checkoutForm');
  if (!form) return;

  form.elements.firstName.value = state.customer.firstName || '';
  form.elements.lastName.value = state.customer.lastName || '';
  form.elements.email.value = state.customer.email || '';
  form.elements.phone.value = state.customer.phone || '';
  form.elements.postcode.value = state.customer.postcode || '';
  form.elements.note.value = state.customer.note || '';
  form.elements.cardNumber.value = state.customer.cardNumber || '';
  form.elements.expiry.value = state.customer.expiry || '';
  form.elements.cvc.value = state.customer.cvc || '';

  const promoInput = document.getElementById('promoInput');
  if (promoInput && state.appliedPromo && state.appliedPromo.code) {
    promoInput.value = state.appliedPromo.code;
  }

  const policyAgreeEl = document.getElementById('policyAgree');
  if (policyAgreeEl) {
    policyAgreeEl.checked = Boolean(state.customer.policyAgreed);
  }
}

function updateCustomerState(form) {
  state.customer = {
    firstName: form.elements.firstName.value,
    lastName: form.elements.lastName.value,
    email: form.elements.email.value,
    phone: form.elements.phone.value,
    postcode: form.elements.postcode.value,
    note: form.elements.note.value,
    cardNumber: form.elements.cardNumber.value,
    expiry: form.elements.expiry.value,
    cvc: form.elements.cvc.value,
    policyAgreed: document.getElementById('policyAgree').checked
  };
  saveState();
}

function setupPolicyToggle() {
  const toggle = document.getElementById('togglePolicy');
  const full = document.getElementById('policyFull');
  const preview = document.getElementById('policyPreview');
  if (!toggle || !full || !preview) return;

  toggle.addEventListener('click', () => {
    full.classList.toggle('show');
    preview.style.display = full.classList.contains('show') ? 'none' : 'block';
  });
}

function applyPromoFromInput() {
  const promoInput = document.getElementById('promoInput');
  const promoFeedback = document.getElementById('promoFeedback');
  const code = promoInput.value.trim();

  if (!code) {
    state.appliedPromo = null;
    promoFeedback.textContent = 'Enter a code to apply a discount.';
    saveState();
    renderPricing();
    return;
  }

  const pricing = getPricing();
  const rateMap = { SAVE10: 0.1, VIP15: 0.15, NEIGHBOUR5: 0.05 };
  const upper = code.toUpperCase();

  if (!rateMap[upper]) {
    state.appliedPromo = { code: upper, discount: 0 };
    promoFeedback.textContent = 'Code not recognised, no discount applied.';
  } else {
    state.appliedPromo = { code: upper, discount: (pricing.subtotal + pricing.tax) * rateMap[upper] };
    promoFeedback.textContent = `${upper} applied.`;
  }

  saveState();
  renderPricing();
}

function renderCheckoutPage() {
  if (state.selectedServiceIds.length === 0) {
    window.location.href = '/services.html';
    return;
  }

  if (!state.selectedDate || !state.selectedTime) {
    window.location.href = '/schedule.html';
    return;
  }

  renderPricing();
  hydrateCheckoutForm();
  setupPolicyToggle();

  const form = document.getElementById('checkoutForm');
  const policyAgreeEl = document.getElementById('policyAgree');
  const policyWarningEl = document.getElementById('policyWarning');
  const formMessage = document.getElementById('formMessage');
  const promoButton = document.getElementById('applyPromo');

  if (promoButton) {
    promoButton.addEventListener('click', applyPromoFromInput);
  }

  form.addEventListener('input', () => updateCustomerState(form));
  policyAgreeEl.addEventListener('change', () => updateCustomerState(form));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    updateCustomerState(form);
    formMessage.textContent = '';

    if (!policyAgreeEl.checked) {
      policyWarningEl.textContent = 'Please accept the cancellation policy to continue.';
      policyAgreeEl.focus();
      return;
    }

    policyWarningEl.textContent = '';

    const payload = {
      services: state.selectedServiceIds,
      date: state.selectedDate,
      time: state.selectedTime,
      firstName: state.customer.firstName,
      lastName: state.customer.lastName,
      email: state.customer.email,
      phone: state.customer.phone,
      postcode: state.customer.postcode,
      note: state.customer.note,
      cancellationAgreed: policyAgreeEl.checked,
      payment: {
        cardNumber: state.customer.cardNumber,
        expiry: state.customer.expiry,
        cvc: state.customer.cvc
      },
      promoCode: state.appliedPromo ? state.appliedPromo.code : form.elements.promo.value
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

    formMessage.textContent = `Appointment confirmed for ${data.appointment.date} at ${data.appointment.time}.`;
    formMessage.style.color = '#0a7d39';
    window.sessionStorage.removeItem(STORAGE_KEY);
  });
}

async function init() {
  if (page === 'home') {
    return;
  }

  await fetchServices();

  if (page === 'services') {
    renderServicesPage();
    return;
  }

  if (page === 'schedule') {
    renderSchedulePage();
    return;
  }

  if (page === 'checkout') {
    renderCheckoutPage();
  }
}

init();
