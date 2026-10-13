
const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys are not configured");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

app.get("/", (req, res) => {
  res.send("ANV payment backend is running.");
});

app.post("/api/create-registration-order", async (req, res) => {
  try {
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: 50000,
      currency: "INR",
      receipt: "anv_" + crypto.randomUUID(),
      notes: { purpose: "ANV registration fee test" }
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error("Create order error:", error.message);
    res.status(500).json({
      error: "Could not create registration order"
    });
  }
});

app.post("/api/verify-registration-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        verified: false,
        message: "Missing payment details"
      });
    }

    const razorpay = getRazorpay();

    // Fetch the order from Razorpay, not just from browser input.
    const order = await razorpay.orders.fetch(razorpay_order_id);

    if (
      order.amount !== 50000 ||
      order.currency !== "INR" ||
      order.status !== "paid"
    ) {
      return res.status(400).json({
        verified: false,
        message: "Order is not confirmed as paid"
      });
    }

    const payment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (
      payment.order_id !== order.id ||
      payment.amount !== 50000 ||
      payment.currency !== "INR" ||
      payment.status !== "captured"
    ) {
      return res.status(400).json({
        verified: false,
        message: "Payment is not captured"
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(order.id + "|" + payment.id)
      .digest("hex");

    const expected = Buffer.from(expectedSignature, "hex");
    const received = Buffer.from(razorpay_signature, "hex");

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return res.status(400).json({
        verified: false,
        message: "Signature verification failed"
      });
    }

    res.json({
      verified: true,
      message: "Test payment verified"
    });
  } catch (error) {
    console.error("Verify payment error:", error.message);
    res.status(400).json({
      verified: false,
      message: "Could not verify payment"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("ANV payment backend listening on " + PORT);
});
