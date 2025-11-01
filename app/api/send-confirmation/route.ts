import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    console.log('📧 Send confirmation email API called')
    const { email, name } = await request.json()
    console.log('Email:', email, 'Name:', name)
    
    if (!email) {
      console.error('❌ No email provided')
      return NextResponse.json({
        success: false,
        error: 'Email is required'
      }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const gmailUser = process.env.GMAIL_USER
    const gmailPassword = process.env.GMAIL_APP_PASSWORD
    
    console.log('Config check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasGmailUser: !!gmailUser,
      hasGmailPassword: !!gmailPassword
    })
    
    if (!gmailUser || !gmailPassword) {
      return NextResponse.json({
        success: false,
        error: 'Gmail credentials not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local'
      }, { status: 500 })
    }
    
    if (!supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'Service role key not configured'
      }, { status: 500 })
    }
    
    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Get the user
    const { data: users, error: getUserError } = await supabase.auth.admin.listUsers()
    
    if (getUserError) {
      return NextResponse.json({
        success: false,
        error: getUserError.message,
      }, { status: 500 })
    }
    
    const user = users.users.find(u => u.email === email)
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found with this email',
      }, { status: 404 })
    }
    
    // Check if already confirmed
    if (user.email_confirmed_at) {
      return NextResponse.json({
        success: false,
        error: 'Email already confirmed',
        confirmedAt: user.email_confirmed_at
      }, { status: 400 })
    }
    
    // Generate a confirmation token (we'll store this in user metadata)
    const confirmationToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    
    // Update user metadata with confirmation token
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          confirmation_token: confirmationToken,
          confirmation_expires: expiresAt.toISOString()
        }
      }
    )
    
    if (updateError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to generate confirmation token',
        details: updateError.message
      }, { status: 500 })
    }
    
    // Create confirmation link
    const confirmUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/confirm-email?token=${confirmationToken}&email=${encodeURIComponent(email)}`
    
    // Send email using Gmail SMTP via nodemailer
    const nodemailer = require('nodemailer')
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPassword
      }
    })
    
    const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>📚 Welcome to BookSimple!</h1>
                </div>
                <div class="content">
                  <p>Hi ${name || 'there'}! 👋</p>
                  <p>Thanks for signing up for BookSimple. To get started, please confirm your email address by clicking the button below:</p>
                  <div style="text-align: center;">
                    <a href="${confirmUrl}" class="button">Confirm Email Address</a>
                  </div>
                  <p>Or copy and paste this link into your browser:</p>
                  <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 4px; font-size: 12px;">
                    ${confirmUrl}
                  </p>
                  <p><strong>This link will expire in 24 hours.</strong></p>
                  <p>If you didn't create an account, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} BookSimple. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `
    
    const mailOptions = {
      from: `"BookSimple" <${gmailUser}>`,
      to: email,
      subject: 'Confirm your email address - BookSimple',
      html: htmlContent
    }
    
    console.log('📤 Sending email to:', email)
    const info = await transporter.sendMail(mailOptions)
    console.log('✅ Email sent successfully:', info.messageId)
    
    return NextResponse.json({
      success: true,
      message: '✅ Confirmation email sent via Gmail',
      messageId: info.messageId,
      expiresIn: '24 hours'
    })
  } catch (error) {
    console.error('❌ Send confirmation error:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
