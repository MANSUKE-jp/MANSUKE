require('dotenv').config({ path: 'VPN/.env' });
const axios = require('axios');
const WG_HOST = process.env.WG_HOST || 'vpn.mansuke.jp';
const WG_PORT = process.env.WG_PORT || '80';
const WG_PASSWORD = process.env.WG_PASSWORD || 'chiru0808';
const WG_API_URL = process.env.WG_API_URL || `http://${WG_HOST}:${WG_PORT}/api`;

async function test() {
    try {
        console.log(`Connecting to ${WG_API_URL}/session...`);
        const response = await axios.post(`${WG_API_URL}/session`, {
            password: WG_PASSWORD
        }, { timeout: 8000 });
        
        const cookies = response.headers['set-cookie'];
        console.log("Cookies:", cookies);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
