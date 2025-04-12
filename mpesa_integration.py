import base64
import json
import logging
import requests
from datetime import datetime
import time

from mpesa_config import (
    MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET,
    MPESA_BUSINESS_SHORT_CODE, MPESA_PASS_KEY,
    MPESA_AUTH_URL, MPESA_STK_PUSH_URL, MPESA_QUERY_URL,
    MPESA_CALLBACK_URL
)

logger = logging.getLogger(__name__)

class MpesaException(Exception):
    """Custom exception for Mpesa API errors"""
    pass

class MpesaIntegration:
    """
    M-PESA Daraja API Integration
    """
    
    @staticmethod
    def get_access_token():
        """
        Get OAuth access token from Safaricom
        """
        if not MPESA_CONSUMER_KEY or not MPESA_CONSUMER_SECRET:
            raise MpesaException("Missing M-PESA API credentials. Please set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET")
            
        try:
            # Create auth string and encode it
            auth_string = f"{MPESA_CONSUMER_KEY}:{MPESA_CONSUMER_SECRET}"
            auth_bytes = auth_string.encode("ascii")
            auth_base64 = base64.b64encode(auth_bytes).decode("ascii")
            
            headers = {
                "Authorization": f"Basic {auth_base64}"
            }
            
            response = requests.get(MPESA_AUTH_URL, headers=headers)
            response_data = response.json()
            
            if 'access_token' in response_data:
                return response_data['access_token']
            else:
                logger.error(f"Failed to get access token: {response_data}")
                raise MpesaException(f"Failed to get access token: {response_data.get('errorMessage', 'Unknown error')}")
                
        except requests.RequestException as e:
            logger.error(f"Network error during token request: {str(e)}")
            raise MpesaException(f"Network error: {str(e)}")
    
    @staticmethod
    def generate_password(timestamp):
        """
        Generate the M-PESA API password using the provided timestamp
        """
        if not MPESA_BUSINESS_SHORT_CODE or not MPESA_PASS_KEY:
            raise MpesaException("Missing M-PESA business credentials. Please set MPESA_BUSINESS_SHORT_CODE and MPESA_PASS_KEY")
            
        data_to_encode = f"{MPESA_BUSINESS_SHORT_CODE}{MPESA_PASS_KEY}{timestamp}"
        encoded_string = base64.b64encode(data_to_encode.encode())
        return encoded_string.decode('utf-8')
    
    @staticmethod
    def initiate_stk_push(phone_number, amount, reference, description="Payment"):
        """
        Initiate STK Push transaction
        
        Args:
            phone_number (str): Customer phone number (format: 254XXXXXXXXX)
            amount (float): Amount to be paid
            reference (str): Your reference for this transaction
            description (str, optional): Transaction description. Defaults to "Payment".
            
        Returns:
            dict: Response from M-PESA API
        """
        # Basic validation
        if not phone_number or not phone_number.startswith('254'):
            raise ValueError("Phone number must be in the format 254XXXXXXXXX")
        
        if not amount or amount <= 0:
            raise ValueError("Amount must be greater than 0")
            
        # Check if API credentials are available
        if not all([MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, 
                   MPESA_BUSINESS_SHORT_CODE, MPESA_PASS_KEY]):
            logger.warning("M-PESA credentials not set. Running in simulation mode.")
            time.sleep(2)  # Simulate API delay
            return {
                "simulation": True,
                "CheckoutRequestID": f"ws_CO_{int(time.time())}",
                "ResponseCode": "0",
                "ResponseDescription": "Success. Request accepted for processing",
                "CustomerMessage": "Success. Request accepted for processing"
            }
        
        try:
            # Get access token
            access_token = MpesaIntegration.get_access_token()
            
            # Prepare the request
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            password = MpesaIntegration.generate_password(timestamp)
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "BusinessShortCode": MPESA_BUSINESS_SHORT_CODE,
                "Password": password,
                "Timestamp": timestamp,
                "TransactionType": "CustomerPayBillOnline",
                "Amount": int(amount),
                "PartyA": phone_number,
                "PartyB": MPESA_BUSINESS_SHORT_CODE,
                "PhoneNumber": phone_number,
                "CallBackURL": MPESA_CALLBACK_URL,
                "AccountReference": reference,
                "TransactionDesc": description
            }
            
            response = requests.post(MPESA_STK_PUSH_URL, 
                                  json=payload, 
                                  headers=headers)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"STK Push failed with status {response.status_code}: {response.text}")
                return {
                    "ResponseCode": "1",
                    "ResponseDescription": f"Error: {response.text}",
                    "error": True
                }
                
        except MpesaException as e:
            logger.error(f"M-PESA API error: {str(e)}")
            return {
                "ResponseCode": "1",
                "ResponseDescription": f"M-PESA API error: {str(e)}",
                "error": True
            }
        except Exception as e:
            logger.error(f"Unexpected error in STK Push: {str(e)}")
            return {
                "ResponseCode": "1",
                "ResponseDescription": f"System error: {str(e)}",
                "error": True
            }
    
    @staticmethod
    def check_transaction_status(checkout_request_id):
        """
        Check the status of an STK Push transaction
        
        Args:
            checkout_request_id (str): The CheckoutRequestID from the STK Push response
            
        Returns:
            dict: Transaction status
        """
        # Check if API credentials are available
        if not all([MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, 
                   MPESA_BUSINESS_SHORT_CODE, MPESA_PASS_KEY]):
            logger.warning("M-PESA credentials not set. Running in simulation mode.")
            time.sleep(1)  # Simulate API delay
            return {
                "simulation": True,
                "ResponseCode": "0",
                "ResponseDescription": "The service request has been accepted successsfully",
                "ResultCode": "0",
                "ResultDesc": "The service request is processed successfully.",
            }
        
        try:
            # Get access token
            access_token = MpesaIntegration.get_access_token()
            
            # Prepare the request
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            password = MpesaIntegration.generate_password(timestamp)
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "BusinessShortCode": MPESA_BUSINESS_SHORT_CODE,
                "Password": password,
                "Timestamp": timestamp,
                "CheckoutRequestID": checkout_request_id
            }
            
            response = requests.post(MPESA_QUERY_URL, 
                                  json=payload, 
                                  headers=headers)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Query failed with status {response.status_code}: {response.text}")
                return {
                    "ResponseCode": "1",
                    "ResponseDescription": f"Error: {response.text}",
                    "error": True
                }
                
        except MpesaException as e:
            logger.error(f"M-PESA API error during status check: {str(e)}")
            return {
                "ResponseCode": "1",
                "ResponseDescription": f"M-PESA API error: {str(e)}",
                "error": True
            }
        except Exception as e:
            logger.error(f"Unexpected error in status check: {str(e)}")
            return {
                "ResponseCode": "1",
                "ResponseDescription": f"System error: {str(e)}",
                "error": True
            }