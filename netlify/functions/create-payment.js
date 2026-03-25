const { Client, Environment } = require('square');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { nonce, amountCents, note, buyerEmail } = JSON.parse(event.body);

    const client = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: Environment.Sandbox
    });

    const response = await client.paymentsApi.createPayment({
      sourceId: nonce,
      idempotencyKey: `${Date.now()}-${Math.random()}`,
      amountMoney: {
        amount: amountCents,
        currency: 'USD'
      },
      note: note || 'Guardian Group Workshop',
      buyerEmailAddress: buyerEmail
    });

    const payment = response.result.payment;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        transactionId: payment.id,
        orderId: payment.orderId || null
      })
    };

  } catch (error) {
    console.error('Square payment error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Payment failed'
      })
    };
  }
};