import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    
    if (!resendApiKey) {
      return NextResponse.json({
        success: false,
        error: 'RESEND_API_KEY not configured in .env.local'
      })
    }
    
    if (!resendApiKey.startsWith('re_')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Resend API key format (should start with re_)'
      })
    }
    
    // Test the API key by sending a test email to a fake address
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BookSimple <onboarding@resend.dev>',
        to: ['delivered@resend.dev'], // Resend test email that always works
        subject: 'Test Email',
        html: '<p>This is a test email to verify Resend API key</p>',
      }),
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Resend API error',
        details: data,
        statusCode: response.status
      }, { status: response.status })
    }
    
    return NextResponse.json({
      success: true,
      message: '✅ Resend API key is working!',
      emailId: data.id,
      testEmailSent: true
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
