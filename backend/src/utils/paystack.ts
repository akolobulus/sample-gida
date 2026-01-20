import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

const api = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    'Content-Type': 'application/json',
  },
});

export const createPaystackCustomer = async (email: string, first_name: string, phone: string) => {
  try {
    const response = await api.post('/customer', { 
      email, 
      first_name, 
      phone 
    });
    return response.data.data.customer_code;
  } catch (error: any) {
    console.error('Paystack Customer Error:', error.response?.data || error.message);
    throw new Error('Failed to create customer on Paystack');
  }
};

export const createVirtualAccount = async (customerCode: string) => {
  try {
    const response = await api.post('/dedicated_account', {
      customer: customerCode,
      preferred_bank: 'wema-bank',
    });
    return {
      account_number: response.data.data.account_number,
      bank_name: response.data.data.bank.name,
    };
  } catch (error: any) {
    console.error('Paystack VA Error:', error.response?.data || error.message);
    throw new Error('Failed to create virtual account');
  }
};