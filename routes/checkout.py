from flask import Blueprint, render_template, jsonify, request
from app import db
from models import Product, Transaction, TransactionItem, StockMovement
from datetime import datetime
import random
import string
import logging

# Create a blueprint for checkout
checkout_bp = Blueprint('checkout', __name__, url_prefix='/checkout')

@checkout_bp.route('/')
def checkout_page():
    """Display the checkout page"""
    return render_template('checkout.html')

@checkout_bp.route('/search', methods=['GET'])
def search_products():
    """API endpoint to search for products by barcode, name, or category"""
    try:
        query = request.args.get('q', '')
        category = request.args.get('category', '')
        
        # Base query
        product_query = Product.query
        
        # Filter by search term if provided
        if query:
            product_query = product_query.filter(
                (Product.name.ilike(f'%{query}%')) |
                (Product.barcode.ilike(f'%{query}%')) |
                (Product.description.ilike(f'%{query}%'))
            )
        
        # Filter by category if provided
        if category:
            product_query = product_query.filter(Product.category == category)
        
        # Get results
        products = product_query.all()
        
        return jsonify({
            'success': True,
            'products': [product.to_dict() for product in products]
        })
    except Exception as e:
        logging.error(f"Error searching products: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@checkout_bp.route('/transactions', methods=['POST'])
def create_transaction():
    """API endpoint to create a new transaction (complete a sale)"""
    try:
        data = request.json
        items = data.get('items', [])
        
        if not items:
            return jsonify({
                'success': False,
                'error': 'Cannot create a transaction with no items'
            }), 400
        
        # Generate a unique reference number
        reference_number = 'TRX-' + ''.join(random.choices(string.digits, k=6))
        
        # Create the transaction
        transaction = Transaction(
            reference_number=reference_number,
            transaction_date=datetime.utcnow(),
            total_amount=float(data.get('total_amount', 0)),
            payment_method=data.get('payment_method', 'cash'),
            payment_reference=data.get('payment_reference', ''),
            cashier_name=data.get('cashier_name', 'System')
        )
        db.session.add(transaction)
        db.session.flush()  # Get the transaction ID without committing
        
        # Add transaction items
        for item in items:
            product_id = item.get('product_id')
            quantity = int(item.get('quantity', 0))
            
            # Get the product
            product = Product.query.get(product_id)
            if not product:
                db.session.rollback()
                return jsonify({
                    'success': False,
                    'error': f'Product with ID {product_id} not found'
                }), 404
            
            # Check if enough stock is available
            if product.stock_quantity < quantity:
                db.session.rollback()
                return jsonify({
                    'success': False,
                    'error': f'Not enough stock for {product.name}. Available: {product.stock_quantity}'
                }), 400
            
            # Create transaction item
            transaction_item = TransactionItem(
                transaction_id=transaction.id,
                product_id=product_id,
                quantity=quantity,
                unit_price=float(product.price),
                total_price=float(product.price * quantity)
            )
            db.session.add(transaction_item)
            
            # Create stock movement
            stock_movement = StockMovement(
                product_id=product_id,
                quantity=-quantity,  # negative because it's a sale
                movement_type='out',
                reference=transaction.reference_number,
                notes=f'Sale transaction {transaction.reference_number}'
            )
            db.session.add(stock_movement)
            
            # Update product stock
            product.stock_quantity -= quantity
        
        # Commit all changes
        db.session.commit()
        
        return jsonify({
            'success': True,
            'transaction': transaction.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating transaction: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@checkout_bp.route('/transactions/<int:transaction_id>', methods=['GET'])
def get_transaction(transaction_id):
    """API endpoint to get details of a specific transaction"""
    try:
        transaction = Transaction.query.get_or_404(transaction_id)
        return jsonify({
            'success': True,
            'transaction': transaction.to_dict()
        })
    except Exception as e:
        logging.error(f"Error fetching transaction {transaction_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@checkout_bp.route('/transactions', methods=['GET'])
def get_transactions():
    """API endpoint to get recent transactions"""
    try:
        transactions = Transaction.query.order_by(Transaction.transaction_date.desc()).limit(50).all()
        return jsonify({
            'success': True,
            'transactions': [transaction.to_dict() for transaction in transactions]
        })
    except Exception as e:
        logging.error(f"Error fetching transactions: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
