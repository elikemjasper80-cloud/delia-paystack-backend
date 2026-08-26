const express = require("express");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 10000;

const PAYSTACK_SECRET_KEY =
    process.env.PAYSTACK_SECRET_KEY;

const DELIA_COMMISSION_RATE = 0.01; // 1%

/*
==================================================
HEALTH CHECK
==================================================
*/

app.get("/", (req, res) => {
    res.json({
        success: true,
        service: "Delia Paystack Backend",
        status: "online"
    });
});


/*
==================================================
INITIALIZE PAYSTACK PAYMENT
==================================================

The browser sends:

{
    email: "customer@example.com",
    amount: 100
}

Amount is in GH₵.

The server converts GH₵100
to 10,000 pesewas for Paystack.
*/

app.post("/initialize-payment", async (req, res) => {

    try {

        if (!PAYSTACK_SECRET_KEY) {

            return res.status(500).json({
                success: false,
                message: "Paystack Secret Key is not configured on the server."
            });

        }


        const email =
            String(req.body.email || "").trim();


        const amountGhs =
            Number(req.body.amount);


        if (!email) {

            return res.status(400).json({
                success: false,
                message: "Customer email is required."
            });

        }


        if (
            !Number.isFinite(amountGhs) ||
            amountGhs <= 0
        ) {

            return res.status(400).json({
                success: false,
                message: "A valid payment amount is required."
            });

        }


        /*
        ==========================================
        CALCULATE DELIA'S 1% COMMISSION
        ==========================================
        */

        const commissionGhs =
            Math.round(
                amountGhs *
                DELIA_COMMISSION_RATE *
                100
            ) / 100;


        const sellerAmountGhs =
            Math.round(
                (
                    amountGhs -
                    commissionGhs
                ) * 100
            ) / 100;


        /*
        ==========================================
        PAYSTACK USES THE SMALLEST CURRENCY UNIT
        ==========================================
        */

        const amountPesewas =
            Math.round(
                amountGhs * 100
            );


        /*
        ==========================================
        UNIQUE PAYMENT REFERENCE
        ==========================================
        */

        const reference =
            "DELIA_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 10);


        /*
        ==========================================
        INITIALIZE PAYSTACK TRANSACTION
        ==========================================
        */

        const response =
            await fetch(
                "https://api.paystack.co/transaction/initialize",
                {

                    method: "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${PAYSTACK_SECRET_KEY}`,

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        email: email,

                        amount:
                            String(amountPesewas),

                        currency: "GHS",

                        reference: reference,

                        metadata: {

                            platform: "Delia",

                            commissionRate:
                                DELIA_COMMISSION_RATE,

                            commissionGhs:
                                commissionGhs,

                            sellerAmountGhs:
                                sellerAmountGhs

                        }

                    })

                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.status
        ) {

            console.error(
                "Paystack initialization failed:",
                data
            );

            return res.status(400).json({

                success: false,

                message:
                    data.message ||
                    "Paystack could not initialize the payment."

            });

        }


        /*
        ==========================================
        SEND ONLY SAFE PAYMENT INFORMATION
        TO THE FRONTEND
        ==========================================
        */

        return res.json({

            success: true,

            authorization_url:
                data.data.authorization_url,

            access_code:
                data.data.access_code,

            reference:
                data.data.reference,

            amountGhs:
                amountGhs,

            commissionGhs:
                commissionGhs,

            sellerAmountGhs:
                sellerAmountGhs

        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message:
                "Unable to initialize payment."

        });

    }

});


/*
==================================================
START SERVER
==================================================
*/

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Delia backend running on port ${PORT}`
        );

    }
);
