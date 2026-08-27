const https = require("https");

function paystackRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : "";

    const options = {
      hostname: "api.paystack.co",
      path,
      method,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
        ...(body
          ? { "Content-Length": Buffer.byteLength(body) }
          : {})
      }
    };

    const req = https.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(responseData);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({
              statusCode: res.statusCode,
              data: parsed
            });
          }
        } catch (error) {
          reject({
            statusCode: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

module.exports = async (req, res) => {
  // Allow your Delia website to call this API.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      success: false,
      message: "Payment server is not configured."
    });
  }

  try {
    const { action, email, amount, reference } = req.body || {};

    // INITIALIZE PAYMENT
    if (action === "initialize") {
      if (!email || !amount) {
        return res.status(400).json({
          success: false,
          message: "Email and amount are required."
        });
      }

      const result = await paystackRequest(
        "/transaction/initialize",
        "POST",
        {
          email,
          amount: Math.round(Number(amount) * 100),
          currency: "GHS",
          reference: reference || undefined
        }
      );

      return res.status(200).json({
        success: true,
        data: result.data
      });
    }

    // VERIFY PAYMENT
    if (action === "verify") {
      if (!reference) {
        return res.status(400).json({
          success: false,
          message: "Payment reference is required."
        });
      }

      const result = await paystackRequest(
        `/transaction/verify/${encodeURIComponent(reference)}`,
        "GET"
      );

      return res.status(200).json({
        success: true,
        data: result.data
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid action."
    });

  } catch (error) {
    console.error(error);

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message: "Payment request failed.",
      error: error.data || error.message
    });
  }
};
