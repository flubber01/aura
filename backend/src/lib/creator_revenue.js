'use strict';
// AURA Area 100 — Creator Revenue, Referral Credits & Payment Simulation.
// Local-first commercial control plane: one immutable referral code per
// creator, referral attribution, anti-abuse gates, a payment-provider adapter
// catalogue and explicitly simulated checkout lifecycles. It never contacts a
// payment provider, collects a card/bank credential, charges money, issues an
// invoice, pays commission or grants a real commercial entitlement.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const auraOsPlus = require('./aura_os_plus');

const FILE = path.join(__dirname, '..', 'data', 'creator_revenue.json');
const CAP = 600;
const PROVIDERS = [
  { id: 'paypal', name: 'PayPal', type: 'wallet / recurring agreement', state: 'NOT_CONNECTED_SIMULATION_ONLY', production_requirements: ['approved merchant account', 'official REST app credentials in a secret manager', 'signed webhook verification', 'subscription/recurring plan mapping', 'refund, dispute and tax handling'] },
  { id: 'klarna', name: 'Klarna', type: 'pay later / local payment methods', state: 'NOT_CONNECTED_SIMULATION_ONLY', production_requirements: ['approved merchant setup per market', 'official API credentials in a secret manager', 'order/session and capture lifecycle', 'signed callbacks, refund and dispute handling', 'consumer-law / disclosure review'] },
  { id: 'revolut_pay', name: 'Revolut Pay', type: 'wallet / merchant checkout', state: 'NOT_CONNECTED_SIMULATION_ONLY', production_requirements: ['approved Revolut Business merchant account', 'official merchant credentials in a secret manager', 'verified callback/webhook endpoint', 'merchant settlement and refund mapping'] },
  { id: 'stripe', name: 'Stripe Billing', type: 'card / subscription billing', state: 'NOT_CONNECTED_SIMULATION_ONLY', production_requirements: ['verified Stripe account', 'Price/Tax configuration', 'signed webhook verification', 'customer portal / cancellation path', 'invoice, refund and chargeback lifecycle'] },
  { id: 'paddle', name: 'Paddle', type: 'merchant of record', state: 'NOT_CONNECTED_SIMULATION_ONLY', production_requirements: ['accepted merchant-of-record agreement', 'product / tax / checkout configuration', 'signed webhook verification', 'refund and cancellation policy mapping'] },
  { id: 'mollie', name: 'Mollie', type: 'European payment methods', state: 'NOT_CONNECTED_SIMULATION_ONLY', production_requirements: ['approved merchant profile', 'official API credentials in a secret manager', 'payment status verification', 'refund / chargeback / settlement mapping'] },
];
const REWARD_POLICY = {
  monthly: { extension_days: 30, title: 'One verified referral month', note: 'After a real provider-validated monthly purchase, the referrer earns one 30-day subscription-extension credit for the qualified tier.' },
  annual: { extension_days: 60, title: 'Annual Creator Accelerator', note: 'After a real provider-validated annual purchase, the referrer earns a 60-day subscription-extension credit plus an annual-accelerator review marker for the qualified tier.' },
};

function empty() { return { affiliates: [], bindings: [], checkouts: [], credits: [], events: [], risk_cases: [], audit: [] }; }
function load() { try { const db = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { ...empty(), ...db, ...Object.fromEntries(Object.keys(empty()).map((k) => [k, Array.isArray(db[k]) ? db[k] : []])) }; } catch { return empty(); } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, FILE); }
function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '-' + crypto.randomBytes(5).toString('hex'); }
function text(value, max = 1200) { return String(value || '').trim().slice(0, max); }
function err(message, code = 400) { const e = new Error(message); e.code = code; return e; }
function audit(db, event, detail = {}) { db.audit.unshift({ id: id('audit'), at: now(), event, ...detail }); if (db.audit.length > CAP) db.audit.length = CAP; }
function requireAdmin(input, action) { const by = text((input || {}).approved_by || (input || {}).admin, 80); const authorization = text((input || {}).admin_authorization, 360); if (!by || authorization.length < 3) throw err('REGEL 1: ' + action + ' braucht approved_by und eine explizite admin_authorization'); return { by, authorization }; }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function profiles() { return auraOsPlus.data().profiles || []; }
function profileById(value) { return profiles().find((x) => x.id === String(value)); }
function planById(value) { return (auraOsPlus.PLANS || []).find((x) => x.id === String(value)); }
function providerById(value) { return PROVIDERS.find((x) => x.id === String(value)); }
function isPaidPlan(plan) { return !!plan && ['pro', 'epic'].includes(plan.tier); }
function cadenceFor(plan) { return /annual/i.test(plan.id) ? 'annual' : 'monthly'; }
function publicAffiliate(a) { return { id: a.id, profile_id: a.profile_id, code: a.code, state: a.state, created_at: a.created_at, public_link: '/creator-revenue?ref=' + encodeURIComponent(a.code), policy: 'One immutable local referral code per creator. The code is not a payment link and cannot trigger any provider call.' }; }
function code(db) { let value; do { value = 'AURA-' + crypto.randomBytes(5).toString('hex').toUpperCase(); } while (db.affiliates.some((x) => x.code === value)); return value; }
function auditView(db) { return db.audit.slice(0, 80); }
function riskFor(db, buyer, referrer, binding) {
  const flags = [];
  if (!buyer || !referrer) flags.push('PROFILE_NOT_FOUND');
  if (buyer && referrer && buyer.id === referrer.id) flags.push('SELF_REFERRAL_PROFILE_MATCH');
  const buyerMail = text(buyer && buyer.contact_email, 180).toLowerCase();
  const referrerMail = text(referrer && referrer.contact_email, 180).toLowerCase();
  if (buyerMail && referrerMail && sha(buyerMail) === sha(referrerMail)) flags.push('SELF_REFERRAL_CONTACT_MATCH');
  if (binding && db.bindings.filter((x) => x.referred_profile_id === binding.referred_profile_id && x.id !== binding.id).length) flags.push('MULTIPLE_REFERRAL_ATTRIBUTIONS');
  if (db.checkouts.filter((x) => x.profile_id === (buyer && buyer.id) && ['SIMULATED_CAPTURED_UNVALIDATED', 'SIMULATED_PURCHASE_VALIDATED_NO_REAL_MONEY', 'PROVIDER_PURCHASE_VALIDATED'].includes(x.state)).length > 1) flags.push('REPEAT_PURCHASE_REVIEW');
  return flags;
}
function ensureCode(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Ausgabe eines eindeutigen Referral-Codes'); const profile = profileById(text(input.profile_id, 100));
  if (!profile) throw err('AURA-OS-Access-Profil unbekannt', 404);
  let affiliate = db.affiliates.find((x) => x.profile_id === profile.id);
  if (!affiliate) { affiliate = { id: id('affiliate'), profile_id: profile.id, code: code(db), state: 'ACTIVE_LOCAL_REFERRAL_CODE', created_at: now(), created_by: a.by, approval: a, issue_count: 1, note: 'One immutable local referral code is issued for this creator. No public tracking, cookie, provider link or external marketing action is created.' }; db.affiliates.unshift(affiliate); audit(db, 'referral_code_issued', { affiliate: affiliate.id, profile: profile.id, by: a.by }); save(db); }
  return { affiliate: publicAffiliate(affiliate), profile: { id: profile.id, display_name: profile.display_name }, note: 'Code exists locally only. Share deliberately; attribution can be bound once before checkout.' };
}
function pauseCode(affiliateId, input = {}) {
  const db = load(); const a = requireAdmin(input, 'Pausieren eines Referral-Codes'); const affiliate = db.affiliates.find((x) => x.id === String(affiliateId)); if (!affiliate) throw err('Referral-Code unbekannt', 404);
  affiliate.state = 'PAUSED_BY_OWNER'; affiliate.paused_at = now(); affiliate.paused_by = a.by; audit(db, 'referral_code_paused', { affiliate: affiliate.id, by: a.by }); save(db); return publicAffiliate(affiliate);
}
function bindReferral(db, buyer, referralCode, a) {
  const normalized = text(referralCode, 80).toUpperCase(); if (!normalized) return null;
  const affiliate = db.affiliates.find((x) => x.code === normalized && x.state === 'ACTIVE_LOCAL_REFERRAL_CODE'); if (!affiliate) throw err('Referral-Code ist unbekannt oder nicht aktiv', 404);
  const existing = db.bindings.find((x) => x.referred_profile_id === buyer.id); if (existing) throw err('Dieses neue Creator-Profil hat bereits eine unveränderliche Referral-Zuordnung', 409);
  if (affiliate.profile_id === buyer.id) throw err('Selbstwerbung ist nicht zulässig', 403);
  const referrer = profileById(affiliate.profile_id); const binding = { id: id('binding'), affiliate_id: affiliate.id, referral_code: affiliate.code, referrer_profile_id: affiliate.profile_id, referred_profile_id: buyer.id, state: 'ATTRIBUTED_PRE_CHECKOUT_PENDING_VALIDATION', created_at: now(), created_by: a.by, approval: a };
  const flags = riskFor(db, buyer, referrer, binding);
  if (flags.some((x) => /SELF_REFERRAL|MULTIPLE/.test(x))) throw err('Referral-Zuordnung ist wegen Anti-Fraud-Gate abgelehnt: ' + flags.join(', '), 403);
  db.bindings.unshift(binding); audit(db, 'referral_bound_before_checkout', { binding: binding.id, affiliate: affiliate.id, buyer: buyer.id, referrer: affiliate.profile_id, by: a.by }); return binding;
}
function createCheckout(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anlage eines simulierten Provider-Checkouts'); const profile = profileById(text(input.profile_id, 100)); const plan = planById(text(input.plan_id, 80)); const provider = providerById(text(input.provider_id, 80));
  if (!profile || !isPaidPlan(plan) || !provider) throw err('Profil, bezahlter Pro-/Epic-Plan und Provider-Szenario sind Pflicht');
  const binding = bindReferral(db, profile, input.referral_code, a);
  const checkout = { id: id('checkout'), profile_id: profile.id, plan_id: plan.id, tier: plan.tier, provider_id: provider.id, provider_state: 'SIMULATION_ONLY_NO_EXTERNAL_PROVIDER_CALL', amount_cents: plan.annual_total_cents || plan.price_cents, display_monthly_cents: plan.price_cents, currency: plan.currency, cadence: cadenceFor(plan), referral_binding_id: binding ? binding.id : null, state: 'SIMULATED_CHECKOUT_CREATED', created_at: now(), created_by: a.by, approval: a, external_state: 'NO_PROVIDER_SESSION_NO_PAYMENT_DATA_NO_CHARGE', disclosure: 'This is a local checkout scenario. AURA did not redirect to, create a session at, collect credentials for, or contact ' + provider.name + '.' };
  db.checkouts.unshift(checkout); audit(db, 'simulated_checkout_created', { checkout: checkout.id, profile: profile.id, plan: plan.id, provider: provider.id, binding: binding && binding.id, by: a.by }); save(db); return { checkout, provider, binding: binding || null, next: 'Use the explicit simulation callback to test an approved, declined or refunded result. This does not represent a provider event.' };
}
function simulateCallback(checkoutId, input = {}) {
  const db = load(); const a = requireAdmin(input, 'Simulation eines Payment-Provider-Callbacks'); const checkout = db.checkouts.find((x) => x.id === String(checkoutId)); if (!checkout) throw err('Checkout unbekannt', 404); if (checkout.state !== 'SIMULATED_CHECKOUT_CREATED') throw err('Dieser Checkout kann nicht erneut simuliert werden', 409);
  const outcome = text(input.outcome, 32).toLowerCase(); if (!['approved', 'declined'].includes(outcome)) throw err('Simulation outcome muss approved oder declined sein');
  checkout.simulation_event_id = 'sim_evt_' + crypto.randomBytes(6).toString('hex'); checkout.simulated_at = now(); checkout.simulated_by = a.by; checkout.provider_state = 'SIMULATED_CALLBACK_NOT_EXTERNAL_WEBHOOK'; checkout.state = outcome === 'approved' ? 'SIMULATED_CAPTURED_UNVALIDATED' : 'SIMULATED_DECLINED'; checkout.simulation_note = text(input.simulation_note, 600) || 'Local provider callback simulation only.';
  db.events.unshift({ id: id('event'), checkout_id: checkout.id, provider_id: checkout.provider_id, type: outcome === 'approved' ? 'SIMULATED_PAYMENT_CAPTURED' : 'SIMULATED_PAYMENT_DECLINED', state: 'SIMULATION_ONLY_NOT_PROVIDER_EVENT', at: now(), actor: a.by }); audit(db, 'simulated_provider_callback', { checkout: checkout.id, outcome, by: a.by }); save(db);
  return { checkout, note: outcome === 'approved' ? 'Simulation captured. A human must now validate it. No money, provider event or commercial entitlement exists.' : 'Simulation declined. No referral credit can be created.' };
}
function rewardFor(checkout, binding) { const policy = REWARD_POLICY[checkout.cadence] || REWARD_POLICY.monthly; return { id: id('credit'), checkout_id: checkout.id, binding_id: binding.id, referrer_profile_id: binding.referrer_profile_id, referred_profile_id: binding.referred_profile_id, tier: checkout.tier, plan_id: checkout.plan_id, extension_days: policy.extension_days, title: policy.title, enhancement: checkout.cadence === 'annual' ? 'ANNUAL_CREATOR_ACCELERATOR_REVIEW_MARKER' : 'STANDARD_CREATOR_MOMENTUM_MARKER', state: 'SIMULATED_REWARD_GRANTED_TEST_ONLY', created_at: now(), application_state: 'NOT_APPLIED_NO_REAL_BILLING_SYSTEM', external_state: 'NO_CASH_PAYOUT_NO_SUBSCRIPTION_CHANGE', policy: policy.note }; }
function validatePurchase(checkoutId, input = {}) {
  const db = load(); const a = requireAdmin(input, 'Validierung eines simulierten Kaufs'); const checkout = db.checkouts.find((x) => x.id === String(checkoutId)); if (!checkout) throw err('Checkout unbekannt', 404); if (checkout.state !== 'SIMULATED_CAPTURED_UNVALIDATED') throw err('Nur eine simuliert erfolgreiche, noch unvalidierte Zahlung kann geprüft werden', 409);
  const evidence = text(input.validation_reference, 700); if (evidence.length < 12) throw err('Eine konkrete lokale Validierungsreferenz (mindestens 12 Zeichen) ist Pflicht');
  checkout.state = 'SIMULATED_PURCHASE_VALIDATED_NO_REAL_MONEY'; checkout.validated_at = now(); checkout.validated_by = a.by; checkout.validation_reference = evidence; checkout.commercial_entitlement = 'NOT_GRANTED_SIMULATION_ONLY';
  const binding = checkout.referral_binding_id && db.bindings.find((x) => x.id === checkout.referral_binding_id); let credit = null; let risk = null;
  if (binding) { const buyer = profileById(checkout.profile_id); const referrer = profileById(binding.referrer_profile_id); const flags = riskFor(db, buyer, referrer, binding); if (flags.length) { risk = { id: id('risk'), checkout_id: checkout.id, binding_id: binding.id, flags, state: 'MANUAL_FRAUD_REVIEW_REQUIRED', created_at: now(), created_by: a.by }; db.risk_cases.unshift(risk); binding.state = 'REWARD_HELD_FOR_RISK_REVIEW'; } else { credit = rewardFor(checkout, binding); db.credits.unshift(credit); binding.state = 'SIMULATED_PURCHASE_VALIDATED_REWARD_GRANTED_TEST_ONLY'; binding.validated_at = now(); } }
  db.events.unshift({ id: id('event'), checkout_id: checkout.id, provider_id: checkout.provider_id, type: 'SIMULATED_PURCHASE_VALIDATED', state: 'LOCAL_VALIDATION_NOT_PROVIDER_SETTLEMENT', at: now(), actor: a.by, evidence_reference: evidence }); audit(db, 'simulated_purchase_validated', { checkout: checkout.id, binding: binding && binding.id, credit: credit && credit.id, risk: risk && risk.id, by: a.by }); save(db);
  return { checkout, credit, risk, note: credit ? 'Simulation-only referral credit recorded after validation. It cannot change a paid subscription, send money or call a provider.' : 'Purchase simulation validated with no referral credit or with a manual risk hold.' };
}
function resolveRiskCase(riskId, input = {}) {
  const db = load(); const a = requireAdmin(input, 'Entscheidung über einen Referral-Fraud-Review'); const risk = db.risk_cases.find((x) => x.id === String(riskId));
  if (!risk) throw err('Fraud-Review-Fall unbekannt', 404); if (risk.state !== 'MANUAL_FRAUD_REVIEW_REQUIRED') throw err('Dieser Fraud-Review-Fall wurde bereits entschieden', 409);
  const decision = text(input.decision, 20).toLowerCase(); if (!['approve', 'reject'].includes(decision)) throw err('Entscheidung muss approve oder reject sein');
  const reason = text(input.reason, 600); if (reason.length < 8) throw err('Die Review-Entscheidung braucht eine nachvollziehbare Begründung (mindestens 8 Zeichen)');
  const checkout = db.checkouts.find((x) => x.id === risk.checkout_id); const binding = db.bindings.find((x) => x.id === risk.binding_id);
  if (!checkout || !binding) throw err('Fraud-Review kann nicht mehr auf Checkout und Referral-Binding abgebildet werden', 409);
  risk.state = decision === 'approve' ? 'MANUAL_REVIEW_APPROVED_TEST_ONLY' : 'MANUAL_REVIEW_REJECTED'; risk.decided_at = now(); risk.decided_by = a.by; risk.decision_reason = reason;
  let credit = null;
  if (decision === 'approve') { credit = rewardFor(checkout, binding); credit.review_override = { risk_case_id: risk.id, approved_by: a.by, reason }; db.credits.unshift(credit); binding.state = 'MANUAL_REVIEW_APPROVED_REWARD_GRANTED_TEST_ONLY'; }
  else binding.state = 'REWARD_REJECTED_BY_FRAUD_REVIEW';
  audit(db, 'referral_fraud_review_resolved', { risk: risk.id, checkout: checkout.id, decision, credit: credit && credit.id, by: a.by }); save(db);
  return { risk, credit, note: decision === 'approve' ? 'Test-only credit recorded after a human local review. It still cannot change billing, access or entitlement.' : 'Referral reward was rejected in the local fraud-review ledger; no external action occurred.' };
}
function reverseSimulation(checkoutId, input = {}) {
  const db = load(); const a = requireAdmin(input, 'Rücknahme einer simulierten Zahlung'); const checkout = db.checkouts.find((x) => x.id === String(checkoutId)); if (!checkout) throw err('Checkout unbekannt', 404); if (!['SIMULATED_CAPTURED_UNVALIDATED', 'SIMULATED_PURCHASE_VALIDATED_NO_REAL_MONEY'].includes(checkout.state)) throw err('Nur eine simuliert erfasste oder validierte Zahlung kann zurückgenommen werden', 409);
  const reason = text(input.reason, 500); if (reason.length < 5) throw err('Rücknahmegrund dokumentieren'); checkout.state = 'SIMULATED_REVERSED'; checkout.reversed_at = now(); checkout.reversed_by = a.by; checkout.reversal_reason = reason;
  const credits = db.credits.filter((x) => x.checkout_id === checkout.id && x.state !== 'SIMULATED_REWARD_REVOKED'); for (const credit of credits) { credit.state = 'SIMULATED_REWARD_REVOKED'; credit.revoked_at = now(); credit.revoked_by = a.by; credit.application_state = 'REVOKED_BEFORE_ANY_BILLING_APPLICATION'; }
  const binding = checkout.referral_binding_id && db.bindings.find((x) => x.id === checkout.referral_binding_id); if (binding) binding.state = 'REWARD_REVOKED_SIMULATED_REVERSAL'; db.events.unshift({ id: id('event'), checkout_id: checkout.id, provider_id: checkout.provider_id, type: 'SIMULATED_PAYMENT_REVERSED', state: 'SIMULATION_ONLY_NOT_PROVIDER_EVENT', at: now(), actor: a.by }); audit(db, 'simulated_payment_reversed', { checkout: checkout.id, credits: credits.map((x) => x.id), by: a.by }); save(db); return { checkout, credits, note: 'Simulation reversal recorded. No external refund or provider communication occurred.' };
}
function redeemSimulationCredit(creditId, input = {}) {
  const db = load(); const a = requireAdmin(input, 'Einlösen eines simulierten Referral-Credits'); const credit = db.credits.find((x) => x.id === String(creditId)); if (!credit) throw err('Referral-Credit unbekannt', 404); if (credit.state !== 'SIMULATED_REWARD_GRANTED_TEST_ONLY' || credit.application_state !== 'NOT_APPLIED_NO_REAL_BILLING_SYSTEM') throw err('Dieser Credit ist nicht mehr als Simulation einlösbar', 409);
  credit.application_state = 'SIMULATED_REDEMPTION_RECORDED_NO_BILLING_CHANGE'; credit.redeemed_at = now(); credit.redeemed_by = a.by; credit.redemption_reference = text(input.redemption_reference, 400) || 'local simulation redemption'; audit(db, 'simulated_referral_credit_redeemed', { credit: credit.id, by: a.by }); save(db); return { credit, note: 'Would extend the matching paid tier by ' + credit.extension_days + ' days only after a real provider/billing integration. No access, invoice, price, money or entitlement was changed here.' };
}
function data() { const db = load(); return { providers: PROVIDERS, reward_policy: REWARD_POLICY, affiliates: db.affiliates.map(publicAffiliate), bindings: db.bindings.slice(0, CAP), checkouts: db.checkouts.slice(0, CAP), credits: db.credits.slice(0, CAP), risk_cases: db.risk_cases.slice(0, CAP), events: db.events.slice(0, CAP), audit: auditView(db), external_state: 'LOCAL_REFERRAL_LEDGER_AND_PAYMENT_SIMULATION_ONLY' }; }
function status() { const db = load(); return { area: '100', mode: 'LIVE', name: 'Creator Revenue, Referral Credits & Payment Simulation', referrals: { unique_creator_codes: db.affiliates.length, attributed_new_creators: db.bindings.length, policy: 'Exactly one immutable active referral code per creator; one pre-checkout attribution per referred creator; self-referral and duplicate attribution are blocked.' }, payment_simulation: { checkouts: db.checkouts.length, captured_unvalidated: db.checkouts.filter((x) => x.state === 'SIMULATED_CAPTURED_UNVALIDATED').length, validated: db.checkouts.filter((x) => x.state === 'SIMULATED_PURCHASE_VALIDATED_NO_REAL_MONEY').length, providers: PROVIDERS.map((x) => ({ id: x.id, state: x.state })), state: 'SIMULATION_ONLY_NO_PROVIDER_CALL_NO_MONEY_MOVEMENT' }, credits: { total: db.credits.length, granted_simulation_only: db.credits.filter((x) => x.state === 'SIMULATED_REWARD_GRANTED_TEST_ONLY').length, annual_bonus_days: REWARD_POLICY.annual.extension_days, monthly_bonus_days: REWARD_POLICY.monthly.extension_days, cash_payout: 'NOT_SUPPORTED' }, fraud_gates: ['one code per creator', 'one attribution per referred creator before checkout', 'self-referral profile/contact match refused', 'manual fraud review queue for suspicious validated records', 'reversal revokes unredeemed simulation credits', 'real provider webhook signatures, settlement, refund and chargeback handling are mandatory before production rewards'], provider_replacement: 'Adapter contracts are intentionally separated from the local simulator so a verified official provider adapter can replace it later without rewriting referral rules.', policy: ['No provider account, checkout session, credential, webhook, invoice, charge, refund, payout or subscription is created by AURA.', 'A simulated approved callback is not a real payment and never grants a commercial clean/watermark-free entitlement.', 'Referral rewards appear only after explicit local validation; simulation rewards are test-only ledger entries.', 'Cash commission, tax reporting, affiliate payout, KYC/AML and legal terms are not implemented and require specialist production design.'] }; }
module.exports = { meta: { area: '100', id: 'creator_revenue', name: 'Creator Revenue, Referral Credits & Payment Simulation', state: 'live' }, actions: { status: () => status(), code_ensure: (p) => ensureCode(p || {}), code_pause: (p) => pauseCode((p || {}).affiliate_id, p || {}), checkout_create: (p) => createCheckout(p || {}), payment_simulate: (p) => simulateCallback((p || {}).checkout_id, p || {}), purchase_validate: (p) => validatePurchase((p || {}).checkout_id, p || {}), payment_reverse: (p) => reverseSimulation((p || {}).checkout_id, p || {}), risk_resolve: (p) => resolveRiskCase((p || {}).risk_id, p || {}), credit_redeem_simulation: (p) => redeemSimulationCredit((p || {}).credit_id, p || {}) }, status, data, ensureCode, pauseCode, createCheckout, simulateCallback, validatePurchase, resolveRiskCase, reverseSimulation, redeemSimulationCredit, PROVIDERS, REWARD_POLICY };
