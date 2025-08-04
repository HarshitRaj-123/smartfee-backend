const axios = require("axios");
require("dotenv").config();

/**
 * Send fee SMS using MSG91
 */
const sendFeeSMS = async (name, phone, amount) => {
  const message = `Dear ${name}, your fee of ₹${amount} has been received.`;

  try {
    const res = await axios.get("https://api.msg91.com/api/v2/sendsms", {
      params: {
        authkey: process.env.MSG91_AUTH_KEY,
        sender: process.env.MSG91_SENDER_ID,
        route: 4, // 4 = transactional
        country: 91,
        mobiles: phone,
        message: message,
      },
    });
    console.log("✅ SMS Sent:", res.data);
    return res.data;
  } catch (error) {
    console.error("❌ SMS Error:", error.response?.data || error.message);
    return null;
  }
};

/**
 * Send WhatsApp message using MSG91 Flow
 */
const sendWhatsApp = async (name, amount, phone) => {
  try {
    const res = await axios.post("https://api.msg91.com/api/v5/whatsapp/flow/", {
      flow_id: process.env.MSG91_FLOW_ID, // must be set in .env
      sender: process.env.MSG91_WHATSAPP_SENDER, // e.g. 91XXXXXXXXXX
      mobiles: `91${phone}`, // MSG91 requires '91' prefix
      VAR1: name,
      VAR2: `₹${amount}`,
    }, {
      headers: {
        authkey: process.env.MSG91_AUTH_KEY,
        "Content-Type": "application/json",
      }
    });

    console.log("✅ WhatsApp Sent:", res.data);
    return res.data;
  } catch (error) {
    console.error("❌ WhatsApp Error:", error.response?.data || error.message);
    return null;
  }
};

module.exports = {
  sendFeeSMS,
  sendWhatsApp,
};
