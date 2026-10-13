
const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay test keys are not configured");
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

app.get("/", (req, res) => {
  res.send("ANV payment backend is running.");
});

// Create a fixed ₹500 test order.
app.post("/create-order", async (req, res) => {
  try {
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: 50000,
      currency: "INR",
      receipt: "anv_" + crypto.randomUUID(),
      notes: {
        purpose: "ANV School registration fee test"
      }
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error("Order creation failed:", error.message);
    res.status(500).json({ error: "Could not create test order" });
  }
});

// Verify Razorpay's checkout signature on the server.
app.post("/verify-payment", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id,
            razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id ||
        !razorpay_signature) {
      return res.status(400).json({
        verified: false,
        message: "Missing payment details"
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({
        verified: false,
        message: "Payment verification is not configured"
      });
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(razorpay_signature, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return res.status(400).json({
        verified: false,
        message: "Signature verification failed"
      });
    }

    res.json({
      verified: true,
      message: "Signature verified. Confirm payment status before marking a fee as paid."
    });
  } catch (error) {
    console.error("Verification failed:", error.message);
    res.status(500).json({
      verified: false,
      message: "Verification failed"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ANV backend listening on port ${PORT}`);
});

