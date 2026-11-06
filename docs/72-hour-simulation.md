# Scheduler simulation and verification

Run with:

```sh
npm install
npm test
```

The scheduler tests use an injected fake clock whose `advance(ms)` method executes due callbacks in timestamp order. No audio context is created and no samples are played during this test.

The 72-hour test:
- starts at a fixed timestamp in UTC;
- advances the fake clock by 72 hours in one operation;
- observes every selected tune/style/key combination;
- asserts that each rolling 40-selection window contains 40 unique IDs;
- runs twice with the same seed and verifies identical selection sequences.

A separate test starts inside quiet hours and verifies that only ballad and musicbox styles are selected. Another stops the scheduler and advances the clock by 72 more hours to ensure no callbacks remain.

This proves deterministic scheduler behavior under the simulated clock. It does not prove real browser timer behavior after tab suspension, OS sleep, device changes or a 72-hour continuous audio soak.
