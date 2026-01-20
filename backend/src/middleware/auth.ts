import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

// Extend Express Request to include user info
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Expecting format: "Bearer [TOKEN]"
  const token = authHeader.split(' ')[1];

  try {
    // Verify the JWT sent from the frontend
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach the user ID to the request object so routes can use it
    req.user = {
      id: user.id,
      email: user.email
    };
    
    next();
  } catch (err) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};