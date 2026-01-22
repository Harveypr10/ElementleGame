# Subscription System Roadmap

## ✅ Phase 1: RevenueCat Integration (COMPLETE)

### Database Schema
- [x] Add `revenuecat_product_id` to `user_tier` table
- [x] Add `revenuecat_subscriber_id` to `user_subscriptions`
- [x] Add `revenuecat_product_id` to `user_subscriptions`
- [x] Make `amount_paid` nullable
- [x] Verify EXCLUDE constraint on `(user_id, validity)`

### Edge Functions
- [x] Create `sync-revenuecat-subscription` (server-side verification)
- [x] Create `handle-revenuecat-webhook` (event processing)
- [x] Fix entitlement parsing (use `entitlements['pro']`)
- [x] Implement extend-or-insert pattern
- [x] Add amount_paid population from user_tier.subscription_cost
- [x] Deploy all functions to production

### Mobile App (React Native)
- [x] Implement `logInRevenueCat()` / `logOutRevenueCat()`
- [x] Add identity linking in auth.tsx (on SIGNED_IN/SIGNED_OUT)
- [x] Update Paywall.tsx to call syncSubscriptionToDatabase()
- [x] Add retry logic for sandbox receipt processing (2-second delay)
- [x] Integrate with useSubscription hook
- [x] Test purchase flow in sandbox
- [x] Fix anonymous logout error
- [x] Move category-selection.tsx to correct directory

### Configuration
- [x] Configure RevenueCat webhook URL
- [x] Set Supabase secrets (REVENUECAT_SECRET_KEY, REVENUECAT_WEBHOOK_SECRET)
- [x] Link products to 'pro' entitlement in RevenueCat dashboard
- [x] Test webhook delivery

---

## ✅ Phase 2: Stripe Integration (COMPLETE)

### Edge Functions
- [x] Create `create-stripe-checkout` (replace Express endpoint)
- [x] Create `handle-stripe-webhook` (replace Express handler)
- [x] Implement extend-or-insert for Stripe subscriptions
- [x] Handle checkout.session.completed, invoice.payment_succeeded
- [x] Handle customer.subscription.deleted (downgrade logic)
- [x] Deploy to production

### Configuration
- [x] Set Supabase secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
- [ ] Configure Stripe webhook URL (when web app migrates)
- [ ] Test Stripe checkout flow (when web app migrates)

---

## ✅ Phase 3: Question Generation Orchestration (COMPLETE)

### Navigation Flow
- [x] Update category-selection.tsx to navigate to generating-questions
- [x] Pass params (userId, postcode, region, categoryIds)
- [x] Move file to app/(auth)/ directory

### Backend Integration (Already in generating-questions.tsx)
- [x] Call populate_user_locations RPC
- [x] Call calculate-demand Edge Function
- [x] Poll questions_allocated_user table
- [x] Navigate to homepage on completion
- [x] React Query cache invalidation

### Testing
- [ ] End-to-end test of category selection → generation → home
- [ ] Verify questions allocated correctly
- [ ] Test error scenarios

---

## 🚧 Phase 4: Production Readiness (IN PROGRESS)

### Mobile App
- [ ] Switch to production RevenueCat API keys
- [ ] Test real Apple purchase (non-sandbox)
- [ ] Submit to App Store with IAP
- [ ] Monitor RevenueCat analytics

### Web App (Future)
- [ ] Update frontend to call create-stripe-checkout Edge Function
- [ ] Remove Express server dependency
- [ ] Test production Stripe flow
- [ ] Configure production webhook
- [ ] Deploy new web app version
- [ ] Decommission Express server

### Monitoring
- [ ] Set up error alerting for Edge Functions
- [ ] Monitor webhook delivery success rate
- [ ] Track subscription conversion rates
- [ ] Monitor database constraint violations

---

## 📊 Success Metrics

### Mobile (RevenueCat)
- ✅ Purchase flow completes successfully
- ✅ Database syncs within 2 seconds
- ✅ Pro features unlock immediately
- ✅ Webhooks process events correctly
- ✅ No constraint violations
- ✅ Multi-region support working

### Web (Stripe)
- ⏳ Pending web app migration
- Edge Functions deployed and ready
- Database schema supports Stripe

### Question Generation
- ✅ Navigation flow complete
- ✅ Backend orchestration implemented
- ⏳ End-to-end testing pending

---

## 🎯 Current State Summary

**Working**:
- ✅ RevenueCat purchases (iOS)
- ✅ Pro subscription activation
- ✅ Database sync (server-verified)
- ✅ Webhook event processing
- ✅ Multi-region support (UK/US)
- ✅ Provider isolation (RevenueCat/Stripe)
- ✅ Question generation navigation

**Ready But Untested**:
- 🧪 Stripe checkout (Edge Functions deployed)
- 🧪 End-to-end question generation

**TODO**:
- 📋 Production deployment
- 📋 Web app migration
- 📋 Express server decommission
