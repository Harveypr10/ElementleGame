# Current Tasks - Mobile App

## 🎯 Active Focus: Testing & Production Readiness

### Priority 1: End-to-End Testing

#### Question Generation Flow
- [ ] Test category selection → generating screen flow
- [ ] Verify backend processing completes
  - [ ] populate_user_locations RPC executes
  - [ ] calculate-demand Edge Function runs
  - [ ] allocate-questions populates questions_allocated_user
- [ ] Confirm navigation to homepage
- [ ] Verify new questions appear
- [ ] Test error scenarios (no postcode, backend failure)

#### RevenueCat Purchase Flow (Sandbox)
- [x] Purchase with sandbox account
- [x] Verify database sync
- [x] Confirm Pro features unlock
- [x] Test restore purchases
- [x] Verify webhook delivery

#### Edge Cases
- [ ] Test poor network conditions
- [ ] Test rapid logout/login cycles
- [ ] Test concurrent category changes
- [ ] Verify constraint violations don't occur

---

### Priority 2: Production Configuration

#### RevenueCat
- [ ] Switch to production API keys
- [ ] Update app.json with production config
- [ ] Test real Apple purchase
- [ ] Monitor first production purchase
- [ ] Verify production webhook works

#### Stripe (When Web Migrates)
- [ ] Configure production Stripe webhook
- [ ] Test checkout flow from web app
- [ ] Monitor first production payment
- [ ] Verify database updates

---

### Priority 3: Code Quality

#### Documentation
- [x] Create handoff brief
- [x] Update roadmap
- [x] Document current tasks
- [ ] Add inline comments to Edge Functions
- [ ] Create troubleshooting guide

#### Error Handling
- [x] Anonymous logout handling
- [x] Retry logic for sandbox
- [x] Graceful webhook failures
- [ ] User-facing error messages
- [ ] Fallback for missing postcode

#### Monitoring
- [ ] Add structured logging to Edge Functions
- [ ] Set up error alerting
- [ ] Create dashboard for subscription metrics
- [ ] Monitor webhook delivery rates

---

## 📂 File Locations

### Edge Functions (Deployed)
```
supabase/functions/
├── sync-revenuecat-subscription/index.ts
├── handle-revenuecat-webhook/index.ts
├── create-stripe-checkout/index.ts
└── handle-stripe-webhook/index.ts
```

### Mobile App (Updated)
```
mobile/
├── lib/
│   ├── RevenueCat.js (identity linking, sync, retry logic)
│   └── auth.tsx (logIn/logOut integration)
├── components/
│   └── Paywall.tsx (database sync on purchase)
├── hooks/
│   └── useSubscription.ts (Pro status)
└── app/
    ├── (auth)/
    │   ├── category-selection.tsx (updated navigation)
    │   └── generating-questions.tsx (backend orchestration)
    └── subscription.tsx
```

### Documentation
```
mobile/docs/
├── HANDOFF_BRIEF.md
├── SUBSCRIPTION_ROADMAP.md
└── CURRENT_TASKS.md
```

---

## 🐛 Known Issues

### None (Fixed Last Session)
All blocking issues resolved:
- ✅ Identity mismatch
- ✅ Entitlement parsing
- ✅ Database constraints
- ✅ Anonymous logout error
- ✅ Routing warnings

---

## 💡 Quick Wins

### Easy Improvements
1. Add loading states to generating screen
2. Better error messages for failed purchases
3. Add "Learn More" link to Paywall
4. Implement promotion code support
5. Add subscription management screen

### Performance
1. Cache event titles for animation
2. Preload generating screen assets
3. Optimize polling interval
4. Add request timeouts

---

## 📞 Need Help With

### Questions for Product
- Should we show progress during question generation?
- What happens if user backs out during generation?
- Error message UX for failed payments?

### Technical Decisions
- Polling vs WebSocket for question allocation?
- Client-side caching strategy?
- Webhook retry logic?

---

## 🎉 Recent Wins

This session completed:
- ✅ Multi-provider subscription system
- ✅ Server-side verification
- ✅ Identity linking
- ✅ Webhook processing
- ✅ Question generation navigation
- ✅ Extend-or-insert pattern
- ✅ All Edge Functions deployed

**Next session focus**: Testing and production deployment!
