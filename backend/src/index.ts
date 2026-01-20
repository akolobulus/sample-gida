import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from './middleware/auth';
import { createPaystackCustomer, createVirtualAccount } from './utils/paystack';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- 1. SYNC USER ROUTE ---
app.post('/api/auth/sync', authenticate, async (req: AuthRequest, res) => {
  const { id, email } = req.user!;
  const { name } = req.body; 

  try {
    let landlord = await prisma.landlord.findUnique({ where: { id } });

    if (!landlord) {
      landlord = await prisma.landlord.create({
        data: {
          id, 
          email: email!,
          name: name || 'Landlord',
        }
      });
      console.log(`New Landlord Created: ${email}`);
    }
    
    res.json({ status: 'synced', user: landlord });
  } catch (error) {
    console.error("Sync Error:", error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// --- 2. PROPERTY ROUTES ---
app.get('/api/properties', authenticate, async (req: AuthRequest, res) => {
  try {
    const properties = await prisma.property.findMany({
      where: { landlordId: req.user!.id },
      include: { units: true }
    });
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

app.post('/api/properties', authenticate, async (req: AuthRequest, res) => {
  const { name, address, city, state } = req.body;
  try {
    const property = await prisma.property.create({
      data: {
        name, address, city, state,
        landlordId: req.user!.id
      }
    });
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// --- 3. UNIT ROUTES ---
app.post('/api/units', authenticate, async (req: AuthRequest, res) => {
  const { propertyId, unitNumber, rentAmount, tenantName, tenantEmail, tenantPhone } = req.body;
  
  try {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, landlordId: req.user!.id }
    });
    if (!property) return res.status(404).json({ error: 'Property not found' });

    let paystackData: any = {};
    
    if (tenantEmail && tenantName && tenantPhone) {
      try {
        const customerCode = await createPaystackCustomer(tenantEmail, tenantName, tenantPhone);
        const accountDetails = await createVirtualAccount(customerCode);
        
        paystackData = {
          paystackCustomerCode: customerCode,
          virtualAccountNumber: accountDetails.account_number,
          virtualBankName: accountDetails.bank_name
        };
      } catch (err) {
        console.warn("Could not create virtual account, continuing without it.");
      }
    }

    const unit = await prisma.unit.create({
      data: {
        unitNumber,
        rentAmount: parseFloat(rentAmount),
        propertyId,
        tenantName,
        tenantEmail,
        tenantPhone,
        ...paystackData
      }
    });

    // Automatically create a Tenant record if details are provided
    if (tenantName) {
      await prisma.tenant.create({
        data: {
          name: tenantName,
          email: tenantEmail,
          phoneNumber: tenantPhone,
          landlordId: req.user!.id,
        }
      });
    }

    res.json(unit);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create unit' });
  }
});

// --- 4. TENANT ROUTES ---
app.get('/api/tenants', authenticate, async (req: AuthRequest, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { landlordId: req.user!.id },
      include: { leases: { include: { unit: true } } }
    });
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

app.post('/api/tenants', authenticate, async (req: AuthRequest, res) => {
  const { name, email, phoneNumber, nationalId } = req.body;
  try {
    const tenant = await prisma.tenant.create({
      data: {
        name,
        email,
        phoneNumber,
        nationalId,
        landlordId: req.user!.id
      }
    });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// --- 5. LEASE ROUTES ---
app.get('/api/leases', authenticate, async (req: AuthRequest, res) => {
  try {
    const leases = await prisma.lease.findMany({
      where: { unit: { property: { landlordId: req.user!.id } } },
      include: { 
        tenant: true,
        unit: { include: { property: true } }
      }
    });
    res.json(leases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leases' });
  }
});

app.post('/api/leases', authenticate, async (req: AuthRequest, res) => {
  const { tenantId, unitId, startDate, endDate, monthlyRent, securityDeposit, status } = req.body;
  
  try {
    const lease = await prisma.lease.create({
      data: {
        tenantId,
        unitId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        monthlyRent: parseFloat(monthlyRent),
        securityDeposit: securityDeposit ? parseFloat(securityDeposit) : 0,
        status: status || 'Active'
      }
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant) {
      await prisma.unit.update({
        where: { id: unitId },
        data: {
          tenantName: tenant.name,
          tenantEmail: tenant.email,
          tenantPhone: tenant.phoneNumber
        }
      });
    }

    res.json(lease);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create lease' });
  }
});

// --- 6. PAYMENT ROUTES ---
app.get('/api/payments', authenticate, async (req: AuthRequest, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: {
        unit: { property: { landlordId: req.user!.id } }
      },
      include: {
        unit: {
          include: { property: true }
        }
      },
      orderBy: { paidAt: 'desc' }
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.post('/api/payments', authenticate, async (req: AuthRequest, res) => {
  const { unitId, amount, date, reference, status } = req.body;
  try {
    const payment = await prisma.payment.create({
      data: {
        unitId,
        amount: parseFloat(amount),
        paidAt: new Date(date),
        reference: reference || `REF-${Math.floor(Math.random() * 1000000)}`,
        status: status || 'success'
      }
    });
    res.json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// --- 7. MAINTENANCE ROUTES ---
app.get('/api/maintenance', authenticate, async (req: AuthRequest, res) => {
  try {
    const requests = await prisma.maintenance.findMany({
      where: { property: { landlordId: req.user!.id } },
      include: { 
        property: true, 
        unit: true 
      },
      orderBy: { date: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch maintenance requests' });
  }
});

app.post('/api/maintenance', authenticate, async (req: AuthRequest, res) => {
  const { propertyId, unitId, title, description, priority, status } = req.body;
  try {
    const request = await prisma.maintenance.create({
      data: {
        propertyId,
        unitId: unitId || null,
        title,
        description,
        priority,
        status: status || 'Pending'
      }
    });
    res.json(request);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create maintenance request' });
  }
});

// --- 8. PAYSTACK WEBHOOK ---
app.post('/api/webhooks/paystack', async (req, res) => {
  const event = req.body;

  if (event.event === 'charge.success') {
    const { amount, reference, customer } = event.data;

    if (customer && customer.customer_code) {
      const unit = await prisma.unit.findFirst({
        where: { paystackCustomerCode: customer.customer_code }
      });

      if (unit) {
        const existingPayment = await prisma.payment.findUnique({
          where: { reference }
        });

        if (!existingPayment) {
          await prisma.payment.create({
            data: {
              amount: amount / 100,
              reference,
              status: 'success',
              unitId: unit.id
            }
          });
          console.log(`Rent Paid for Unit: ${unit.unitNumber}`);
        }
      }
    }
  }
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});