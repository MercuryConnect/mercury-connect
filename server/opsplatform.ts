/**
 * Ops Platform Integration Module
 * 
 * Connects to the Mercury Holdings Ops Platform Supabase database
 * to validate active users and send verification emails via Mailgun.
 */

import { createClient } from '@supabase/supabase-js';

// Ops Platform Supabase configuration
const SUPABASE_URL = 'https://osmmguimnvsahdahrrsj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.OPS_SUPABASE_SERVICE_KEY || '';

// Mailgun configuration
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = 'mail.mercuryholdings.co';

// In-memory store for verification codes (in production, use Redis or database)
const verificationCodes = new Map<string, { code: string; expiresAt: Date; email: string }>();

/**
 * Get Supabase client for Ops Platform
 */
function getOpsSupabaseClient() {
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('OPS_SUPABASE_SERVICE_KEY environment variable is not set');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * Check if an email belongs to an active Ops Platform user
 */
export async function isActiveOpsUser(email: string): Promise<boolean> {
  try {
    const supabase = getOpsSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('id, email, status')
      .eq('email', email.toLowerCase())
      .eq('status', 'active')
      .single();
    
    if (error) {
      console.error('[OpsIntegration] Error checking user:', error.message);
      return false;
    }
    
    return !!data;
  } catch (err) {
    console.error('[OpsIntegration] Failed to check active user:', err);
    return false;
  }
}

/**
 * Get active user details from Ops Platform
 */
export async function getActiveOpsUser(email: string): Promise<{ id: string; email: string; name?: string } | null> {
  try {
    const supabase = getOpsSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('id, email, contact_id')
      .eq('email', email.toLowerCase())
      .eq('status', 'active')
      .single();
    
    if (error || !data) {
      return null;
    }
    
    // Try to get the user's name from the contacts table if contact_id exists
    let name: string | undefined;
    if (data.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('first_name, last_name')
        .eq('id', data.contact_id)
        .single();
      
      if (contact) {
        name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
      }
    }
    
    return {
      id: data.id,
      email: data.email,
      name: name || undefined
    };
  } catch (err) {
    console.error('[OpsIntegration] Failed to get user:', err);
    return null;
  }
}

/**
 * Generate a 6-digit verification code
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification code via Mailgun
 */
async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  if (!MAILGUN_API_KEY) {
    console.error('[OpsIntegration] MAILGUN_API_KEY not set');
    return false;
  }
  
  const formData = new URLSearchParams();
  formData.append('from', 'Mercury Holdings <noreply@mail.mercuryholdings.co>');
  formData.append('to', email);
  formData.append('subject', 'Your Mercury Connect Verification Code');
  formData.append('html', `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { max-width: 200px; }
        .code-box { 
          background: #f5f5f5; 
          border: 2px solid #1E5AA8; 
          border-radius: 8px; 
          padding: 20px; 
          text-align: center; 
          margin: 20px 0;
        }
        .code { 
          font-size: 32px; 
          font-weight: bold; 
          color: #1E5AA8; 
          letter-spacing: 4px;
        }
        .footer { 
          margin-top: 30px; 
          padding-top: 20px; 
          border-top: 1px solid #eee; 
          font-size: 12px; 
          color: #666; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="color: #1E5AA8;">Mercury Holdings</h2>
          <p style="color: #E86C2C; font-weight: bold;">Remote Desktop Support</p>
        </div>
        
        <p>Hello,</p>
        
        <p>You requested access to Mercury Connect. Use the verification code below to complete your login:</p>
        
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        
        <p>If you didn't request this code, please ignore this email.</p>
        
        <div class="footer">
          <p>This is an automated message from Mercury Holdings Ops Platform.</p>
          <p>© ${new Date().getFullYear()} Mercury Holdings. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `);
  formData.append('text', `
Mercury Holdings - Remote Desktop Support

Your verification code is: ${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

© ${new Date().getFullYear()} Mercury Holdings. All rights reserved.
  `);
  
  try {
    const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpsIntegration] Mailgun error:', response.status, errorText);
      return false;
    }
    
    console.log('[OpsIntegration] Verification email sent to:', email);
    return true;
  } catch (err) {
    console.error('[OpsIntegration] Failed to send email:', err);
    return false;
  }
}

/**
 * Request a verification code for an email
 * Returns true if the code was sent successfully
 */
export async function requestVerificationCode(email: string): Promise<{ success: boolean; error?: string }> {
  // Check if the email belongs to an active Ops Platform user
  const isActive = await isActiveOpsUser(email);
  
  if (!isActive) {
    return { 
      success: false, 
      error: 'This email is not associated with an active Mercury Holdings account.' 
    };
  }
  
  // Generate a new verification code
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  // Store the code
  verificationCodes.set(email.toLowerCase(), { code, expiresAt, email: email.toLowerCase() });
  
  // Send the email
  const sent = await sendVerificationEmail(email, code);
  
  if (!sent) {
    return { success: false, error: 'Failed to send verification email. Please try again.' };
  }
  
  return { success: true };
}

/**
 * Verify a code for an email
 */
export async function verifyCode(email: string, code: string): Promise<{ success: boolean; user?: { id: string; email: string; name?: string }; error?: string }> {
  const stored = verificationCodes.get(email.toLowerCase());
  
  if (!stored) {
    return { success: false, error: 'No verification code found. Please request a new code.' };
  }
  
  if (new Date() > stored.expiresAt) {
    verificationCodes.delete(email.toLowerCase());
    return { success: false, error: 'Verification code has expired. Please request a new code.' };
  }
  
  if (stored.code !== code) {
    return { success: false, error: 'Invalid verification code. Please try again.' };
  }
  
  // Code is valid, delete it
  verificationCodes.delete(email.toLowerCase());
  
  // Get user details
  const user = await getActiveOpsUser(email);
  
  if (!user) {
    return { success: false, error: 'User account not found or inactive.' };
  }
  
  return { success: true, user };
}

/**
 * Clean up expired verification codes (call periodically)
 */
export function cleanupExpiredCodes(): void {
  const now = new Date();
  const entries = Array.from(verificationCodes.entries());
  for (const [email, data] of entries) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
    }
  }
}

// Clean up expired codes every 5 minutes
setInterval(cleanupExpiredCodes, 5 * 60 * 1000);
