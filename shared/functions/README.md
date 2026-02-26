# Shared Backend Functions

This directory contains cloud functions that are technically deployable from anywhere, but logically shared across the MANSUKE ecosystem. 

For example, `payment.js` provides `processPayment` and `refundPayment`, which enforce atomic database transactions on the MyMANSUKE `users` database.

## Usage
To use these functions, any of the applications with a `functions/` directory can require them using a relative path, and re-export them in their `functions/index.js` file so they are deployed alongside the app.

Example (`apps/MyMANSUKE/functions/index.js`):
```javascript
const { processPayment, refundPayment } = require('../../../shared/functions/payment.js');

module.exports = {
    // ...
    processPayment,
    refundPayment,
};
```
