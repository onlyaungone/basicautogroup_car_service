const STORAGE_KEY = 'basicauto-booking-state';
const CONFIRMATION_KEY = 'basicauto-last-confirmation';
const DROP_OFF_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00'
];

const state = loadState();
const page = document.body.dataset.page;

let services = [];
let dropoffAvailability = [];

function defaultState() {
  return {
    selectedServiceIds: [],
    dropoffDate: '',
    dropoffTime: '',
    pickupDate: '',
    pickupTime: '',
    appliedPromo: null,
    vehicle: {
      make: '',
      model: '',
      year: '',
      series: '',
      odometer: '',
      lastServiceDate: '',
      registration: ''
    },
    customer: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      suburb: '',
      stateRegion: '',
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
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      vehicle: { ...base.vehicle, ...(parsed.vehicle || {}) },
      customer: { ...base.customer, ...(parsed.customer || {}) }
    };
  } catch (_error) {
    return defaultState();
  }
}

function saveState() {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isPastDropoffSlot(date, time) {
  if (!date || !time) {
    return false;
  }
  return parseDateTime(date, time) < new Date();
}

function todayString() {
  return formatDateForInput(new Date());
}

function yesterdayString() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatDateForInput(date);
}

function parseDateTime(date, time) {
  return new Date(`${date}T${time}:00`);
}

function formatAppointment(date, time) {
  return date && time ? `${time} ${date}` : 'Select a date and time';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function noteToHtml(value) {
  return escapeHtml(value || '').replace(/\n/g, '<br>');
}

function parseLegacyNote(note) {
  const text = String(note || '');
  const parsed = {
    customerNote: '',
    vehicle: {
      make: '',
      model: '',
      year: '',
      series: '',
      odometer: '',
      lastServiceDate: '',
      registration: ''
    },
    addressLine1: '',
    addressLine2: '',
    suburb: '',
    stateRegion: '',
    postcode: ''
  };

  const customerNoteMatch = text.match(/Customer note:\s*(.*?)(?=\s+Vehicle:|$)/);
  if (customerNoteMatch) {
    parsed.customerNote = customerNoteMatch[1].trim();
  }

  const vehicleMatch = text.match(/Vehicle:\s*(.*?)(?=\s+Odometer KMs:|$)/);
  if (vehicleMatch) {
    const vehicleText = vehicleMatch[1].trim();
    const vehicleParts = vehicleText.split(/\s+/);
    if (vehicleParts.length > 0) parsed.vehicle.year = vehicleParts.shift() || '';
    if (vehicleParts.length > 0) parsed.vehicle.make = vehicleParts.shift() || '';
    if (vehicleParts.length > 0) parsed.vehicle.model = vehicleParts.shift() || '';
    parsed.vehicle.series = vehicleParts.join(' ');
  }

  const odometerMatch = text.match(/Odometer KMs:\s*(.*?)(?=\s+Last Service Date:|$)/);
  if (odometerMatch) parsed.vehicle.odometer = odometerMatch[1].trim();

  const lastServiceMatch = text.match(/Last Service Date:\s*(.*?)(?=\s+Registration:|$)/);
  if (lastServiceMatch) parsed.vehicle.lastServiceDate = lastServiceMatch[1].trim();

  const registrationMatch = text.match(/Registration:\s*(.*?)(?=\s+Drop-off:|$)/);
  if (registrationMatch) parsed.vehicle.registration = registrationMatch[1].trim();

  const addressMatch = text.match(/Address:\s*(.*)$/);
  if (addressMatch) {
    const addressText = addressMatch[1].trim();
    const addressParts = addressText.split(',').map(part => part.trim()).filter(Boolean);
    parsed.addressLine1 = addressParts[0] || '';
    if (addressParts.length === 4) {
      parsed.addressLine2 = addressParts[1] || '';
      parsed.suburb = addressParts[2] || '';
      const statePostcode = (addressParts[3] || '').split(/\s+/);
      parsed.stateRegion = statePostcode[0] || '';
      parsed.postcode = statePostcode[1] || '';
    } else if (addressParts.length >= 3) {
      parsed.suburb = addressParts[1] || '';
      const statePostcode = (addressParts[2] || '').split(/\s+/);
      parsed.stateRegion = statePostcode[0] || '';
      parsed.postcode = statePostcode[1] || '';
    }
  }

  return parsed;
}

function hydrateAppointmentDetails(appointment) {
  const legacy = parseLegacyNote(appointment.note);
  const vehicle = {
    ...legacy.vehicle,
    ...(appointment.vehicle || {})
  };

  return {
    ...appointment,
    vehicle,
    addressLine1: appointment.addressLine1 || legacy.addressLine1,
    addressLine2: appointment.addressLine2 || legacy.addressLine2,
    suburb: appointment.suburb || legacy.suburb,
    stateRegion: appointment.stateRegion || legacy.stateRegion,
    postcode: appointment.postcode || legacy.postcode,
    customerNote: legacy.customerNote
  };
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

async function getCurrentUser() {
  const data = await api('/api/auth/me', { method: 'GET', headers: {} });
  return data.user;
}

async function fetchServices() {
  const data = await api('/api/services', { method: 'GET', headers: {} });
  services = data.services || [];
}

function getSelectedServices() {
  return services.filter(service => state.selectedServiceIds.includes(service.id));
}

function getPricing() {
  const subtotal = getSelectedServices().reduce((sum, service) => sum + service.price, 0);
  const tax = subtotal * 0.1;
  const discount = state.appliedPromo ? state.appliedPromo.discount : 0;
  return { subtotal, tax, discount, total: Math.max(0, subtotal + tax - discount) };
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
  container.innerHTML = selected.length === 0
    ? '<p class="hint">Add a service to view pricing.</p>'
    : selected.map(service => `<div class="summary__row"><span>${service.name}</span><strong>${formatCurrency(service.price)}</strong></div>`).join('');
}

function renderVehicleSummary() {
  const summary = [state.vehicle.year, state.vehicle.make, state.vehicle.model].filter(Boolean).join(' ');
  setText('vehicleSummary', summary ? `${summary} (${state.vehicle.registration})` : 'Add vehicle information');
  const detail = document.getElementById('vehicleSummaryDetail');
  if (detail) {
    const rows = [
      ['Make', state.vehicle.make],
      ['Model', state.vehicle.model],
      ['Year', state.vehicle.year],
      ['Series', state.vehicle.series],
      ['Odometer KMs', state.vehicle.odometer],
      ['Last Service', state.vehicle.lastServiceDate],
      ['Registration', state.vehicle.registration]
    ];
    detail.innerHTML = rows.map(([label, value]) => `<div class="summary__row"><span>${label}</span><strong>${value || '-'}</strong></div>`).join('');
  }
}

function renderAppointmentSummary() {
  setText('summaryAppointment', formatAppointment(state.dropoffDate, state.dropoffTime));
  setText('summaryDropoff', formatAppointment(state.dropoffDate, state.dropoffTime));
  setText('summaryPickup', formatAppointment(state.pickupDate, state.pickupTime));
  setText('summaryPickupAside', formatAppointment(state.pickupDate, state.pickupTime));
}

function renderPricing() {
  const pricing = getPricing();
  setText('summarySubtotal', formatCurrency(pricing.subtotal));
  setText('summaryTax', formatCurrency(pricing.tax));
  setText('summaryDiscount', `-${formatCurrency(pricing.discount)}`);
  setText('summaryTotal', formatCurrency(pricing.total));
  renderSummaryServices();
  renderVehicleSummary();
  renderAppointmentSummary();
}

function setButtonState(id, enabled) {
  const button = document.getElementById(id);
  if (!button) return;
  button.classList.toggle('is-disabled', !enabled);
  button.setAttribute('aria-disabled', String(!enabled));
}

function canContinueFromServices() {
  return state.selectedServiceIds.length > 0 &&
    Object.values(state.vehicle).every(Boolean);
}

function minimumPickupDateTime() {
  if (!state.dropoffDate || !state.dropoffTime) return null;
  const date = parseDateTime(state.dropoffDate, state.dropoffTime);
  date.setHours(date.getHours() + 3);
  return date;
}

function pickupIsValid() {
  const minPickup = minimumPickupDateTime();
  return Boolean(minPickup && state.pickupDate && state.pickupTime && parseDateTime(state.pickupDate, state.pickupTime) >= minPickup);
}

function canContinueFromAppointment() {
  return canContinueFromServices() && state.dropoffDate && state.dropoffTime && state.pickupDate && state.pickupTime && pickupIsValid();
}

function digitsOnly(value, maxLength) {
  return value.replace(/\D+/g, '').slice(0, maxLength);
}

function formatExpiry(value) {
  const digits = digitsOnly(value, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function toggleService(id) {
  state.selectedServiceIds = state.selectedServiceIds.includes(id)
    ? state.selectedServiceIds.filter(serviceId => serviceId !== id)
    : [...state.selectedServiceIds, id];
  saveState();
}

function renderServiceCards() {
  const list = document.getElementById('serviceList');
  if (!list) return;
  list.innerHTML = '';
  services.forEach(service => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div><h3>${service.name}</h3><p>${service.description}</p></div>
      <div class="price-row">
        <span class="price">${formatCurrency(service.price)}</span>
        <button type="button" class="btn ghost small">${state.selectedServiceIds.includes(service.id) ? 'Remove' : 'Add'}</button>
      </div>
    `;
    card.querySelector('button').addEventListener('click', () => {
      toggleService(service.id);
      renderServiceCards();
      renderSelectedServices('selectedServices');
      renderPricing();
      setButtonState('continueToAppointment', canContinueFromServices());
    });
    list.appendChild(card);
  });
}

function bindVehicleInputs() {
  const fields = [['vehicleMake', 'make'], ['vehicleModel', 'model'], ['vehicleYear', 'year'], ['vehicleSeries', 'series'], ['vehicleOdometer', 'odometer'], ['vehicleLastServiceDate', 'lastServiceDate'], ['vehicleRegistration', 'registration']];
  const lastService = document.getElementById('vehicleLastServiceDate');
  if (lastService) lastService.max = yesterdayString();
  fields.forEach(([id, key]) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = state.vehicle[key] || '';
    input.addEventListener('input', event => {
      let value = event.target.value;
      if (key === 'year') value = digitsOnly(value, 4);
      if (key === 'odometer') value = digitsOnly(value, 7);
      if (key === 'lastServiceDate' && value >= todayString()) value = '';
      event.target.value = value;
      state.vehicle[key] = value;
      saveState();
      renderPricing();
      setButtonState('continueToAppointment', canContinueFromServices());
    });
  });
}

function ensureDropoffDate() {
  if (!state.dropoffDate) state.dropoffDate = formatDateForInput(new Date());
  saveState();
  return state.dropoffDate;
}

async function fetchDropoffAvailability(date) {
  const data = await api(`/api/availability?date=${encodeURIComponent(date)}`, { method: 'GET', headers: {} });
  dropoffAvailability = data.slots || [];
}

function renderTimeButtons(containerId, slots, selected, onSelect, allowUnavailable = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  slots.forEach(slot => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot';
    button.textContent = slot.time || slot;
    const time = slot.time || slot;
    const available = slot.available !== false || allowUnavailable;
    if (!available) {
      button.classList.add('unavailable');
      button.disabled = true;
    }
    if (selected === time) button.classList.add('selected');
    button.addEventListener('click', () => onSelect(time));
    container.appendChild(button);
  });
}

function pickupSlotsForDate(date) {
  const minPickup = minimumPickupDateTime();
  if (!date || !minPickup) return [];
  return DROP_OFF_SLOTS.filter(time => parseDateTime(date, time) >= minPickup);
}

async function renderServicesPage() {
  await fetchServices();
  renderServiceCards();
  renderSelectedServices('selectedServices');
  bindVehicleInputs();
  renderPricing();
  setButtonState('continueToAppointment', canContinueFromServices());
}

async function renderSchedulePage() {
  if (!canContinueFromServices()) {
    window.location.href = '/services';
    return;
  }
  await fetchServices();
  renderSelectedServices('selectedServices');
  renderPricing();

  const dropoffInput = document.getElementById('dropoffDateInput');
  const pickupInput = document.getElementById('pickupDateInput');
  dropoffInput.value = ensureDropoffDate();
  await fetchDropoffAvailability(state.dropoffDate);

  const drawDropoff = () => {
    const morningSlots = dropoffAvailability
      .filter(slot => slot.period === 'morning')
      .map(slot => ({
        ...slot,
        available: slot.available && !isPastDropoffSlot(state.dropoffDate, slot.time)
      }));
    const afternoonSlots = dropoffAvailability
      .filter(slot => slot.period === 'afternoon')
      .map(slot => ({
        ...slot,
        available: slot.available && !isPastDropoffSlot(state.dropoffDate, slot.time)
      }));

    renderTimeButtons('dropoffMorningSlots', morningSlots, state.dropoffTime, time => {
      state.dropoffTime = time;
      if (!pickupIsValid()) {
        state.pickupDate = '';
        state.pickupTime = '';
      }
      saveState();
      drawDropoff();
      drawPickup();
      renderPricing();
      setButtonState('continueToCheckout', canContinueFromAppointment());
    });
    renderTimeButtons('dropoffAfternoonSlots', afternoonSlots, state.dropoffTime, time => {
      state.dropoffTime = time;
      if (!pickupIsValid()) {
        state.pickupDate = '';
        state.pickupTime = '';
      }
      saveState();
      drawDropoff();
      drawPickup();
      renderPricing();
      setButtonState('continueToCheckout', canContinueFromAppointment());
    });
  };

  const drawPickup = () => {
    const minPickup = minimumPickupDateTime();
    pickupInput.min = minPickup ? formatDateForInput(minPickup) : '';
    if (!state.pickupDate && minPickup) state.pickupDate = formatDateForInput(minPickup);
    pickupInput.value = state.pickupDate || '';
    const slots = pickupSlotsForDate(state.pickupDate);
    renderTimeButtons('pickupMorningSlots', slots.filter(time => Number(time.split(':')[0]) < 12), state.pickupTime, time => {
      state.pickupTime = time;
      saveState();
      drawPickup();
      renderPricing();
      setButtonState('continueToCheckout', canContinueFromAppointment());
    }, true);
    renderTimeButtons('pickupAfternoonSlots', slots.filter(time => Number(time.split(':')[0]) >= 12), state.pickupTime, time => {
      state.pickupTime = time;
      saveState();
      drawPickup();
      renderPricing();
      setButtonState('continueToCheckout', canContinueFromAppointment());
    }, true);
  };

  dropoffInput.addEventListener('change', async event => {
    state.dropoffDate = event.target.value;
    state.dropoffTime = '';
    state.pickupDate = '';
    state.pickupTime = '';
    saveState();
    await fetchDropoffAvailability(state.dropoffDate);
    drawDropoff();
    drawPickup();
    renderPricing();
    setButtonState('continueToCheckout', false);
  });

  pickupInput.addEventListener('change', event => {
    state.pickupDate = event.target.value;
    state.pickupTime = '';
    saveState();
    drawPickup();
    renderPricing();
    setButtonState('continueToCheckout', canContinueFromAppointment());
  });

  drawDropoff();
  drawPickup();
  setButtonState('continueToCheckout', canContinueFromAppointment());
}

function hydrateCheckoutForm(form) {
  Object.entries(state.customer).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value || '';
  });
  if (form.elements.stateRegion) form.elements.stateRegion.value = state.customer.stateRegion || '';
  const policy = document.getElementById('policyAgree');
  if (policy) policy.checked = Boolean(state.customer.policyAgreed);
  const promo = document.getElementById('promoInput');
  if (promo && state.appliedPromo) promo.value = state.appliedPromo.code;
}

function updateCustomerState(form) {
  Object.keys(state.customer).forEach(key => {
    if (key === 'policyAgreed') return;
    if (form.elements[key]) state.customer[key] = form.elements[key].value;
  });
  state.customer.policyAgreed = document.getElementById('policyAgree').checked;
  saveState();
}

function bindCheckoutFormatting(form) {
  form.elements.phone.addEventListener('input', event => {
    event.target.value = digitsOnly(event.target.value, 10);
    updateCustomerState(form);
  });
  form.elements.postcode.addEventListener('input', event => {
    event.target.value = digitsOnly(event.target.value, 4);
    updateCustomerState(form);
  });
  form.elements.cardNumber.addEventListener('input', event => {
    event.target.value = digitsOnly(event.target.value, 16);
    updateCustomerState(form);
  });
  form.elements.expiry.addEventListener('input', event => {
    event.target.value = formatExpiry(event.target.value);
    updateCustomerState(form);
  });
  form.elements.cvc.addEventListener('input', event => {
    event.target.value = digitsOnly(event.target.value, 4);
    updateCustomerState(form);
  });
}

function buildBookingNote() {
  return [
    state.customer.note ? `Customer note: ${state.customer.note}` : '',
    `Vehicle: ${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model} ${state.vehicle.series}`,
    `Odometer KMs: ${state.vehicle.odometer}`,
    `Last Service Date: ${state.vehicle.lastServiceDate}`,
    `Registration: ${state.vehicle.registration}`,
    `Drop-off: ${formatAppointment(state.dropoffDate, state.dropoffTime)}`,
    `Pick-up: ${formatAppointment(state.pickupDate, state.pickupTime)}`,
    `Address: ${state.customer.addressLine1}${state.customer.addressLine2 ? `, ${state.customer.addressLine2}` : ''}, ${state.customer.suburb}, ${state.customer.stateRegion} ${state.customer.postcode}`
  ].filter(Boolean).join('\n');
}

async function renderCheckoutPage() {
  if (!canContinueFromAppointment()) {
    window.location.href = '/schedule';
    return;
  }
  await fetchServices();
  renderPricing();
  const form = document.getElementById('checkoutForm');
  hydrateCheckoutForm(form);
  bindCheckoutFormatting(form);

  const togglePolicy = document.getElementById('togglePolicy');
  const policyFull = document.getElementById('policyFull');
  const policyPreview = document.getElementById('policyPreview');
  togglePolicy.addEventListener('click', () => {
    policyFull.classList.toggle('show');
    policyPreview.style.display = policyFull.classList.contains('show') ? 'none' : 'block';
  });

  document.getElementById('applyPromo').addEventListener('click', () => {
    const code = document.getElementById('promoInput').value.trim().toUpperCase();
    const rates = { SAVE10: 0.1, VIP15: 0.15, NEIGHBOUR5: 0.05 };
    const pricing = getPricing();
    state.appliedPromo = code && rates[code] ? { code, discount: (pricing.subtotal + pricing.tax) * rates[code] } : code ? { code, discount: 0 } : null;
    saveState();
    renderPricing();
    document.getElementById('promoFeedback').textContent = code ? (rates[code] ? `${code} applied.` : 'Code not recognised, no discount applied.') : 'Enter a code to apply a discount.';
  });

  form.addEventListener('input', () => updateCustomerState(form));
  document.getElementById('policyAgree').addEventListener('change', () => updateCustomerState(form));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    updateCustomerState(form);
    if (!document.getElementById('policyAgree').checked) {
      document.getElementById('policyWarning').textContent = 'Please accept the cancellation policy to continue.';
      return;
    }
    const data = await api('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        services: state.selectedServiceIds,
        date: state.dropoffDate,
        time: state.dropoffTime,
        pickupDate: state.pickupDate,
        pickupTime: state.pickupTime,
        firstName: state.customer.firstName,
        lastName: state.customer.lastName,
        email: state.customer.email,
        phone: state.customer.phone,
        addressLine1: state.customer.addressLine1,
        addressLine2: state.customer.addressLine2,
        suburb: state.customer.suburb,
        stateRegion: state.customer.stateRegion,
        postcode: state.customer.postcode,
        vehicle: state.vehicle,
        note: buildBookingNote(),
        cancellationAgreed: true,
        payment: {
          cardNumber: state.customer.cardNumber,
          expiry: state.customer.expiry,
          cvc: state.customer.cvc
        },
        promoCode: state.appliedPromo ? state.appliedPromo.code : ''
      })
    });
    window.sessionStorage.setItem(CONFIRMATION_KEY, JSON.stringify(data));
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.location.href = `/confirmation?id=${data.appointment.id}`;
  });
}

function renderConfirmationPage() {
  const raw = window.sessionStorage.getItem(CONFIRMATION_KEY);
  const panel = document.getElementById('confirmationPanel');
  const appointmentsLink = document.getElementById('confirmationAppointmentsLink');
  if (!raw) {
    panel.innerHTML = '<p class="status">No recent confirmation was found.</p>';
    return;
  }
  const data = JSON.parse(raw);
  panel.innerHTML = `
    <h2>Appointment #${data.appointment.id}</h2>
    <p><strong>Drop-off:</strong> ${formatAppointment(data.appointment.date, data.appointment.time)}</p>
    <p><strong>Pick-up:</strong> ${formatAppointment(data.appointment.pickupDate, data.appointment.pickupTime)}</p>
    <p><strong>Total:</strong> ${formatCurrency(data.appointment.total)}</p>
  `;

  getCurrentUser()
    .then(user => {
      appointmentsLink.href = user ? '/appointments' : '/account';
    })
    .catch(() => {
      appointmentsLink.href = '/account';
    });
}

async function renderAccountPage() {
  try {
    const user = await getCurrentUser();
    if (user) {
      window.location.href = '/appointments';
      return;
    }
  } catch (_error) {
    // Continue to auth forms when there is no active session.
  }

  const signinForm = document.getElementById('signinForm');
  const signupForm = document.getElementById('signupForm');
  const signinTab = document.getElementById('showSigninTab');
  const signupTab = document.getElementById('showSignupTab');
  const passwordInput = document.getElementById('signupPassword');
  const passwordMeterFill = document.getElementById('passwordMeterFill');
  const passwordStrength = document.getElementById('passwordStrength');

  function showSignin() {
    signinForm.classList.remove('auth-form--hidden');
    signupForm.classList.add('auth-form--hidden');
    signinTab.classList.add('is-active');
    signupTab.classList.remove('is-active');
  }

  function showSignup() {
    signupForm.classList.remove('auth-form--hidden');
    signinForm.classList.add('auth-form--hidden');
    signupTab.classList.add('is-active');
    signinTab.classList.remove('is-active');
  }

  signinTab.addEventListener('click', showSignin);
  signupTab.addEventListener('click', showSignup);
  document.getElementById('switchToSignup').addEventListener('click', showSignup);
  document.getElementById('switchToSignin').addEventListener('click', showSignin);

  document.querySelectorAll('.password-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.classList.toggle('is-visible', !showing);
      button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });

  passwordInput.addEventListener('input', event => {
    const value = event.target.value;
    const score = Math.min(4, [
      value.length >= 8,
      /[A-Z]/.test(value),
      /[0-9]/.test(value),
      /[^A-Za-z0-9]/.test(value)
    ].filter(Boolean).length);
    const widths = ['0%', '25%', '50%', '75%', '100%'];
    const colors = ['#ef4f4f', '#ef4f4f', '#f09a36', '#3f85ff', '#18a05e'];
    const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    passwordMeterFill.style.width = widths[score];
    passwordMeterFill.style.background = colors[score];
    passwordStrength.textContent = `Strength: ${labels[score]}`;
  });

  signupForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.elements.password.value !== form.elements.confirmPassword.value) {
      document.getElementById('signupMessage').textContent = 'Passwords do not match.';
      return;
    }
    try {
      await api('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.elements.firstName.value,
          lastName: form.elements.lastName.value,
          email: form.elements.email.value,
          password: form.elements.password.value
        })
      });
      document.getElementById('signupMessage').textContent = 'Account created. Redirecting to appointments...';
      window.location.href = '/appointments';
    } catch (error) {
      document.getElementById('signupMessage').textContent = error.message;
    }
  });

  signinForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: form.elements.email.value,
          password: form.elements.password.value
        })
      });
      document.getElementById('signinMessage').textContent = 'Signed in. Redirecting...';
      window.location.href = '/appointments';
    } catch (error) {
      document.getElementById('signinMessage').textContent = error.message;
    }
  });
}

async function renderAppointmentsPage() {
  try {
    const user = await getCurrentUser();
    document.getElementById('accountDetailsPanel').innerHTML = `
      <h2>My account details</h2>
      <div class="summary__row"><span>First name</span><strong>${user.firstName}</strong></div>
      <div class="summary__row"><span>Last name</span><strong>${user.lastName}</strong></div>
      <div class="summary__row"><span>Email</span><strong>${user.email}</strong></div>
    `;
    const data = await api('/api/appointments', { method: 'GET', headers: {} });
    const list = document.getElementById('appointmentsList');
    list.innerHTML = data.appointments.length === 0
      ? '<div class="panel"><p class="status">No appointments found for this account.</p></div>'
      : data.appointments.map(appointment => `
        <article class="card">
          <div>
            <h3>Appointment #${appointment.id}</h3>
            <p>${appointment.status.toUpperCase()}</p>
            <p>Drop-off: ${formatAppointment(appointment.date, appointment.time)}</p>
            <p>Pick-up: ${formatAppointment(appointment.pickupDate, appointment.pickupTime)}</p>
          </div>
          <a class="btn primary" href="/appointment?id=${appointment.id}">View details</a>
        </article>
      `).join('');
  } catch (error) {
    document.getElementById('appointmentsMessage').textContent = error.message;
    document.getElementById('accountDetailsPanel').innerHTML = '';
    document.getElementById('appointmentsList').innerHTML = '<div class="panel"><a class="btn primary" href="/account">Sign in</a></div>';
  }

  document.getElementById('signOutButton').addEventListener('click', async () => {
    await api('/api/auth/signout', { method: 'POST', body: '{}' });
    window.location.href = '/account';
  });
}

async function renderAppointmentDetailPage() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) return;
  try {
    const data = await api(`/api/appointments/${id}`, { method: 'GET', headers: {} });
    const appointment = hydrateAppointmentDetails(data.appointment);
    const servicesHtml = (appointment.services || []).length === 0
      ? '<p class="hint">No services recorded.</p>'
      : appointment.services.map(service => `<div class="summary__row"><span>${service.name}</span><strong>${formatCurrency(service.price)}</strong></div>`).join('');
    const vehicle = appointment.vehicle || {};
    document.getElementById('appointmentDetailPanel').innerHTML = `
      <h2>Appointment #${appointment.id}</h2>
      <div class="summary__row"><span>Status</span><strong>${appointment.status}</strong></div>
      <div class="summary__row"><span>Drop-off</span><strong>${formatAppointment(appointment.date, appointment.time)}</strong></div>
      <div class="summary__row"><span>Pick-up</span><strong>${formatAppointment(appointment.pickupDate, appointment.pickupTime)}</strong></div>
      <div class="summary__row"><span>Subtotal</span><strong>${formatCurrency(appointment.subtotal)}</strong></div>
      <div class="summary__row"><span>Tax</span><strong>${formatCurrency(appointment.tax)}</strong></div>
      <div class="summary__row"><span>Discount</span><strong>${formatCurrency(appointment.discount)}</strong></div>
      <div class="summary__row"><span>Late-change fee</span><strong>${formatCurrency(appointment.lateChangeFee)}</strong></div>
      <div class="summary__row"><span>Total</span><strong>${formatCurrency(appointment.total)}</strong></div>
      <div class="summary-block">
        <span class="summary-block__title">Customer details</span>
        <div class="summary__row"><span>Name</span><strong>${appointment.firstName} ${appointment.lastName}</strong></div>
        <div class="summary__row"><span>Email</span><strong>${appointment.email}</strong></div>
        <div class="summary__row"><span>Phone</span><strong>${appointment.phone}</strong></div>
      </div>
      <div class="summary-block">
        <span class="summary-block__title">Address</span>
        <div class="summary__row"><span>Address line 1</span><strong>${appointment.addressLine1 || '-'}</strong></div>
        <div class="summary__row"><span>Address line 2</span><strong>${appointment.addressLine2 || '-'}</strong></div>
        <div class="summary__row"><span>Suburb</span><strong>${appointment.suburb || '-'}</strong></div>
        <div class="summary__row"><span>State</span><strong>${appointment.stateRegion || '-'}</strong></div>
        <div class="summary__row"><span>Postcode</span><strong>${appointment.postcode || '-'}</strong></div>
      </div>
      <div class="summary-block">
        <span class="summary-block__title">Vehicle</span>
        <div class="summary__row"><span>Make</span><strong>${vehicle.make || '-'}</strong></div>
        <div class="summary__row"><span>Model</span><strong>${vehicle.model || '-'}</strong></div>
        <div class="summary__row"><span>Year</span><strong>${vehicle.year || '-'}</strong></div>
        <div class="summary__row"><span>Series</span><strong>${vehicle.series || '-'}</strong></div>
        <div class="summary__row"><span>Odometer KMs</span><strong>${vehicle.odometer || '-'}</strong></div>
        <div class="summary__row"><span>Last Service</span><strong>${vehicle.lastServiceDate || '-'}</strong></div>
        <div class="summary__row"><span>Registration</span><strong>${vehicle.registration || '-'}</strong></div>
      </div>
      <div class="summary-block">
        <span class="summary-block__title">Services</span>
        ${servicesHtml}
      </div>
      <div class="summary-block">
        <span class="summary-block__title">Notes</span>
        <p>${appointment.customerNote ? noteToHtml(appointment.customerNote) : 'No notes recorded.'}</p>
      </div>
    `;

    const form = document.getElementById('rescheduleForm');
    if (appointment.status === 'cancelled') {
      form.remove();
      return;
    }

    form.elements.date.value = appointment.date;
    form.elements.time.value = appointment.time;
    form.elements.pickupDate.value = appointment.pickupDate;
    form.elements.pickupTime.value = appointment.pickupTime;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const updated = await api(`/api/appointments/${id}/reschedule`, {
          method: 'POST',
          body: JSON.stringify({
            date: form.elements.date.value,
            time: form.elements.time.value,
            pickupDate: form.elements.pickupDate.value,
            pickupTime: form.elements.pickupTime.value
          })
        });
        document.getElementById('appointmentActionMessage').textContent = `Updated to ${formatAppointment(updated.appointment.date, updated.appointment.time)}.`;
      } catch (error) {
        document.getElementById('appointmentActionMessage').textContent = error.message;
      }
    });

    document.getElementById('cancelAppointmentButton').addEventListener('click', async () => {
      try {
        const result = await api(`/api/appointments/${id}/cancel`, { method: 'POST', body: '{}' });
        document.getElementById('appointmentActionMessage').textContent = result.lateChangeFee > 0
          ? `Appointment cancelled. Late-change fee applied: ${formatCurrency(result.lateChangeFee)}. New total: ${formatCurrency(result.total)}.`
          : `Appointment cancelled. New total: ${formatCurrency(result.total)}.`;
        form.remove();
      } catch (error) {
        document.getElementById('appointmentActionMessage').textContent = error.message;
      }
    });
  } catch (error) {
    document.getElementById('appointmentDetailPanel').innerHTML = `<p class="status">${error.message}</p>`;
  }
}

async function init() {
  if (page === 'services') return renderServicesPage();
  if (page === 'schedule') return renderSchedulePage();
  if (page === 'checkout') return renderCheckoutPage();
  if (page === 'confirmation') return renderConfirmationPage();
  if (page === 'account') return renderAccountPage();
  if (page === 'appointments') return renderAppointmentsPage();
  if (page === 'appointment-detail') return renderAppointmentDetailPage();
}

init();
