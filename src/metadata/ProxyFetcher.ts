import {HttpsProxyAgent} from "https-proxy-agent";
import axios from 'axios';

const apifyUsername = 'groups-RESIDENTIAL';
const apifyPassword = process.env.APIFY_PASSWORD;
const fullUrl = `http://${apifyUsername}:${apifyPassword}@proxy.apify.com:8000`

export class ProxyFetcher {
    private agent: HttpsProxyAgent<string>;

    constructor() {
       this.agent = new HttpsProxyAgent(fullUrl);
    }

    async fetch(url: string, retries = 3) {
        let response;
        for (let i = 0; i < retries; i++) {
            try {
                response = await axios({
                    method: 'get',
                    httpsAgent: this.agent,
                    url: url,
                })
                return response.data;
            } catch (error) {
                if(error.response && error.response.status === 404) {
                    return {};
                }
                if(i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
            }
        }
    }
}