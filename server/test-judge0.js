const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config({ path: "./server/.env" });

async function testJudge0() {
  try {
    const response = await axios.get(`${process.env.JUDGE0_URL}/about`, {
      headers: {
        "x-rapidapi-key": process.env.JUDGE0_API_KEY,
        "x-rapidapi-host": process.env.JUDGE0_RAPIDAPI_HOST,
      },
    });
    console.log("Success:", response.data);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
}

testJudge0();
