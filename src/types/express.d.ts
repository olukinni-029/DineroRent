/* eslint-disable @typescript-eslint/no-unused-vars */
import express from 'express';

// interface AgentPayload {
//   id: string;
//   email: string;
//   role: 'agent';
// }

// interface LenderPayload {
//   id: string;
//   email: string;
//   role: 'lender';
// }

// interface AdminPayload {
//   id: string;
//   email: string;
//   role: "admin";
// }

// interface AggregatorPayload {
//   id: string;
//   email: string;
//   phone: string;
//   role: "aggregator";
// }

declare global {
  namespace Express {
    interface Request {
      user?: any;
      vendor?: any;
    }
  }
}