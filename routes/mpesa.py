from flask import Blueprint, request, jsonify, session, redirect, url_for
import logging
import json
from datetime import datetime

from app import db
from models import Transaction
from mpesa_integration import MpesaIntegration

# Create blueprint
mpesa_bp = Blueprint('mpesa', __name__, url_prefix='/mpesa')

logger = logging.getLogger(__name__)

@mpesa_bp.route('/initiate', methods=['POST'])
def initiate_payment():
    """
    Initiate an M-PESA STK Push payment
    """
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['phone_number', 'amount', 'reference']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Validate phone number format
        phone = data['phone_number']
        if not phone.startswith('254'):
            return jsonify({
                'success': False,
                'message': 'Phone number should be in the format 254XXXXXXXXX'
            }), 400
        
        amount = float(data['amount'])
        reference = data['reference']
        description = data.get('description', 'Payment for goods')
        
        # Initiate STK Push
        result = MpesaIntegration.initiate_stk_push(
            phone_number=phone,
            amount=amount,
            reference=reference,
            description=description
        )
        
        # Check for errors
        if result.get('error', False):
            return jsonify({
                'success': False,
                'message': result.get('ResponseDescription', 'Failed to initiate payment'),
                'data': result
            }), 400
        
        # Store checkout request ID in session for later verification
        checkout_request_id = result.get('CheckoutRequestID')
        if checkout_request_id:
            # Store in session - this could also be stored in a database
            session['mpesa_checkout_id'] = checkout_request_id
            session['mpesa_reference'] = reference
            session['mpesa_amount'] = amount
            
        # Return success response
        return jsonify({
            'success': True,
            'message': 'Payment initiated successfully. Please complete on your phone.',
            'data': {
                'checkout_request_id': checkout_request_id,
                'reference': reference,
                'simulation': result.get('simulation', False)
            }
        })
        
    except Exception as e:
        logger.error(f"Error initiating M-PESA payment: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        }), 500

@mpesa_bp.route('/callback', methods=['POST'])
def mpesa_callback():
    """
    Callback URL for M-PESA payment notifications
    
    This endpoint will be called by Safaricom when a payment is completed
    """
    try:
        # Parse the M-PESA callback data
        callback_data = request.json
        logger.info(f"M-PESA callback received: {json.dumps(callback_data)}")
        
        # Extract the necessary information
        # The structure depends on the callback data format from Safaricom
        if 'Body' in callback_data and 'stkCallback' in callback_data['Body']:
            stk_callback = callback_data['Body']['stkCallback']
            
            checkout_request_id = stk_callback.get('CheckoutRequestID')
            result_code = stk_callback.get('ResultCode')
            result_desc = stk_callback.get('ResultDesc')
            
            # Success case
            if result_code == 0:
                # Payment was successful
                # Extract payment details
                callback_metadata = stk_callback.get('CallbackMetadata', {}).get('Item', [])
                
                # Extract metadata values
                amount = next((item['Value'] for item in callback_metadata if item['Name'] == 'Amount'), 0)
                mpesa_receipt = next((item['Value'] for item in callback_metadata if item['Name'] == 'MpesaReceiptNumber'), '')
                transaction_date = next((item['Value'] for item in callback_metadata if item['Name'] == 'TransactionDate'), '')
                phone_number = next((item['Value'] for item in callback_metadata if item['Name'] == 'PhoneNumber'), '')
                
                logger.info(f"Successful M-PESA payment: {mpesa_receipt}, Amount: {amount}, Phone: {phone_number}")
                
                # TODO: Update transaction in database
                # This would typically update a pending transaction to 'completed'
                
                # Return success response (Safaricom expects a specific format)
                return jsonify({
                    "ResultCode": 0,
                    "ResultDesc": "Confirmation received successfully"
                })
            else:
                # Payment failed
                logger.error(f"M-PESA payment failed: {result_desc}")
                
                # TODO: Update transaction in database to 'failed'
                
                # Return acknowledgement to Safaricom
                return jsonify({
                    "ResultCode": 0,
                    "ResultDesc": "Confirmation received successfully"
                })
        
        # Invalid callback data
        logger.warning(f"Invalid M-PESA callback data: {callback_data}")
        return jsonify({
            "ResultCode": 1,
            "ResultDesc": "Invalid callback data"
        }), 400
        
    except Exception as e:
        logger.error(f"Error processing M-PESA callback: {str(e)}")
        return jsonify({
            "ResultCode": 1,
            "ResultDesc": f"Error: {str(e)}"
        }), 500

@mpesa_bp.route('/verify/<checkout_request_id>', methods=['GET'])
def verify_payment(checkout_request_id):
    """
    Verify the status of an M-PESA payment
    """
    try:
        result = MpesaIntegration.check_transaction_status(checkout_request_id)
        
        # Check for errors
        if result.get('error', False):
            return jsonify({
                'success': False,
                'message': result.get('ResponseDescription', 'Failed to verify payment'),
                'data': result
            }), 400
        
        # Check result code
        result_code = result.get('ResultCode')
        
        # Payment succeeded
        if result_code == 0:
            # Here you might update a transaction in the database
            return jsonify({
                'success': True,
                'message': 'Payment completed successfully',
                'data': {
                    'result_code': result_code,
                    'result_desc': result.get('ResultDesc', 'Success'),
                    'simulation': result.get('simulation', False)
                }
            })
        
        # Payment is still processing or failed
        return jsonify({
            'success': False,
            'message': result.get('ResultDesc', 'Payment verification failed'),
            'data': {
                'result_code': result_code,
                'result_desc': result.get('ResultDesc', 'Pending or failed payment'),
                'simulation': result.get('simulation', False)
            }
        })
        
    except Exception as e:
        logger.error(f"Error verifying M-PESA payment: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        }), 500