import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()
    
    console.log('🚀 Custom registration for:', email)
    
    if (!email || !password || !name) {
      return NextResponse.json({
        success: false,
        error: 'Email, password, and name are required'
      }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const gmailUser = process.env.GMAIL_USER
    const gmailPassword = process.env.GMAIL_APP_PASSWORD
    
    if (!supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'Service role key not configured'
      }, { status: 500 })
    }
    
    if (!gmailUser || !gmailPassword) {
      return NextResponse.json({
        success: false,
        error: 'Gmail credentials not configured'
      }, { status: 500 })
    }
    
    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const userExists = existingUsers?.users.some(u => u.email === email)
    
    if (userExists) {
      return NextResponse.json({
        success: false,
        error: 'User with this email already exists'
      }, { status: 400 })
    }
    
    // Create user using admin API (bypasses rate limits)
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: false, // We'll confirm via our email
      user_metadata: {
        display_name: name
      }
    })
    
    if (createError) {
      console.error('❌ Failed to create user:', createError)
      return NextResponse.json({
        success: false,
        error: createError.message
      }, { status: 500 })
    }
    
    console.log('✅ User created:', newUser.user?.id)
    
    // Add to user_list table
    if (newUser.user) {
      const { error: dbError } = await supabase
        .from("user_list")
        .insert([
          {
            email: email,
            display_name: name,
            auth_user_id: newUser.user.id,
          },
        ])

      if (dbError) {
        console.warn('⚠️ User list insertion warning:', dbError)
      }
    }
    
    // Generate confirmation token
    const confirmationToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    
    // Store token in user metadata
    await supabase.auth.admin.updateUserById(
      newUser.user!.id,
      {
        user_metadata: {
          display_name: name,
          confirmation_token: confirmationToken,
          confirmation_expires: expiresAt.toISOString()
        }
      }
    )
    
    // Send confirmation email via Gmail
    const nodemailer = require('nodemailer')
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPassword
      }
    })
    
    const confirmUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/confirm-email?token=${confirmationToken}&email=${encodeURIComponent(email)}`
    
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
              <p>Hi ${name}! 👋</p>
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
    
    console.log('📤 Sending confirmation email to:', email)
    const info = await transporter.sendMail(mailOptions)
    console.log('✅ Email sent successfully:', info.messageId)
    
    return NextResponse.json({
      success: true,
      message: 'Registration successful! Please check your email to confirm your account.',
      userId: newUser.user?.id,
      emailSent: true
    })
    
  } catch (error) {
    console.error('❌ Custom registration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    }, { status: 500 })
  }
}
