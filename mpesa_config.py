import os

# M-PESA Configuration
# Replace these default values with your own credentials when available
# You can set them as environment variables or update directly in this file

# Consumer Key and Secret for API authentication
MPESA_CONSUMER_KEY = os.environ.get('MPESA_CONSUMER_KEY', '')
MPESA_CONSUMER_SECRET = os.environ.get('MPESA_CONSUMER_SECRET', '')

# Business details
MPESA_BUSINESS_SHORT_CODE = os.environ.get('MPESA_BUSINESS_SHORT_CODE', '174379')  # Default is sandbox paybill
MPESA_PASS_KEY = os.environ.get('MPESA_PASS_KEY', '')

# API Endpoints - Using sandbox URLs for testing
MPESA_ENVIRONMENT = 'sandbox'  # Change to 'production' for live environment

# URL endpoints
if MPESA_ENVIRONMENT == 'sandbox':
    MPESA_AUTH_URL = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    MPESA_STK_PUSH_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    MPESA_QUERY_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query'
else:
    MPESA_AUTH_URL = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    MPESA_STK_PUSH_URL = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    MPESA_QUERY_URL = 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'

# Callback URLs
MPESA_CALLBACK_URL = 'https://your-domain.com/mpesa/callback'  # Update with your callback URL