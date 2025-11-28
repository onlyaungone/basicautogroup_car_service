function applyPromoCode(code, subtotal) {
  if (!code) return { code: null, discount: 0 };
  const normalized = code.trim().toUpperCase();
  const promoMap = {
    SAVE10: 0.1,
    VIP15: 0.15,
    NEIGHBOUR5: 0.05
  };
  const rate = promoMap[normalized];
  if (!rate) return { code: normalized, discount: 0 };
  return { code: normalized, discount: subtotal * rate };
}

module.exports = { applyPromoCode };
