from flask import Blueprint, render_template, jsonify, request
from app import db
from models import Product, Transaction, TransactionItem
import logging
from sqlalchemy import func
from datetime import datetime, timedelta

# Create a blueprint for reports
reports_bp = Blueprint('reports', __name__, url_prefix='/reports')

@reports_bp.route('/')
def reports_page():
    """Display the reports page"""
    return render_template('reports.html')

@reports_bp.route('/sales/summary', methods=['GET'])
def sales_summary():
    """API endpoint to get sales summary data"""
    try:
        # Get filter parameters
        period = request.args.get('period', 'today')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Define date range based on period
        now = datetime.utcnow()
        if period == 'today':
            start = datetime(now.year, now.month, now.day, 0, 0, 0)
            end = datetime(now.year, now.month, now.day, 23, 59, 59)
        elif period == 'week':
            start = now - timedelta(days=7)
            end = now
        elif period == 'month':
            start = datetime(now.year, now.month, 1, 0, 0, 0)
            end = now
        elif period == 'custom':
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d")
                end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
            except (ValueError, TypeError):
                return jsonify({
                    'success': False,
                    'error': 'Invalid date format. Use YYYY-MM-DD.'
                }), 400
        else:
            start = datetime(now.year, now.month, now.day, 0, 0, 0)
            end = datetime(now.year, now.month, now.day, 23, 59, 59)
        
        # Get sales data
        sales_data = db.session.query(
            func.count(Transaction.id).label('total_transactions'),
            func.sum(Transaction.total_amount).label('total_sales'),
            func.avg(Transaction.total_amount).label('average_sale')
        ).filter(
            Transaction.transaction_date.between(start, end)
        ).first()
        
        # Get payment method breakdown
        payment_methods = db.session.query(
            Transaction.payment_method,
            func.count(Transaction.id).label('count'),
            func.sum(Transaction.total_amount).label('total')
        ).filter(
            Transaction.transaction_date.between(start, end)
        ).group_by(
            Transaction.payment_method
        ).all()
        
        # Format payment methods data
        payment_data = [
            {
                'method': method, 
                'count': count, 
                'total': float(total) if total else 0
            } 
            for method, count, total in payment_methods
        ]
        
        return jsonify({
            'success': True,
            'data': {
                'period': {
                    'start': start.isoformat(),
                    'end': end.isoformat(),
                    'name': period
                },
                'sales': {
                    'total_transactions': sales_data.total_transactions if sales_data.total_transactions else 0,
                    'total_sales': float(sales_data.total_sales) if sales_data.total_sales else 0,
                    'average_sale': float(sales_data.average_sale) if sales_data.average_sale else 0
                },
                'payment_methods': payment_data
            }
        })
    except Exception as e:
        logging.error(f"Error generating sales summary: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@reports_bp.route('/sales/by-category', methods=['GET'])
def sales_by_category():
    """API endpoint to get sales data grouped by product category"""
    try:
        # Get filter parameters
        period = request.args.get('period', 'today')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Define date range based on period
        now = datetime.utcnow()
        if period == 'today':
            start = datetime(now.year, now.month, now.day, 0, 0, 0)
            end = datetime(now.year, now.month, now.day, 23, 59, 59)
        elif period == 'week':
            start = now - timedelta(days=7)
            end = now
        elif period == 'month':
            start = datetime(now.year, now.month, 1, 0, 0, 0)
            end = now
        elif period == 'custom':
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d")
                end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
            except (ValueError, TypeError):
                return jsonify({
                    'success': False,
                    'error': 'Invalid date format. Use YYYY-MM-DD.'
                }), 400
        else:
            start = datetime(now.year, now.month, now.day, 0, 0, 0)
            end = datetime(now.year, now.month, now.day, 23, 59, 59)
        
        # Get sales by category
        sales_by_cat = db.session.query(
            Product.category,
            func.sum(TransactionItem.total_price).label('total_sales'),
            func.sum(TransactionItem.quantity).label('quantity_sold')
        ).join(
            TransactionItem, TransactionItem.product_id == Product.id
        ).join(
            Transaction, Transaction.id == TransactionItem.transaction_id
        ).filter(
            Transaction.transaction_date.between(start, end)
        ).group_by(
            Product.category
        ).all()
        
        # Format category data
        category_data = [
            {
                'category': category,
                'total_sales': float(total_sales) if total_sales else 0,
                'quantity_sold': quantity_sold if quantity_sold else 0
            }
            for category, total_sales, quantity_sold in sales_by_cat
        ]
        
        return jsonify({
            'success': True,
            'data': {
                'period': {
                    'start': start.isoformat(),
                    'end': end.isoformat(),
                    'name': period
                },
                'categories': category_data
            }
        })
    except Exception as e:
        logging.error(f"Error generating sales by category: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@reports_bp.route('/sales/top-products', methods=['GET'])
def top_products():
    """API endpoint to get top selling products"""
    try:
        # Get filter parameters
        period = request.args.get('period', 'today')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = int(request.args.get('limit', 10))
        
        # Define date range based on period
        now = datetime.utcnow()
        if period == 'today':
            start = datetime(now.year, now.month, now.day, 0, 0, 0)
            end = datetime(now.year, now.month, now.day, 23, 59, 59)
        elif period == 'week':
            start = now - timedelta(days=7)
            end = now
        elif period == 'month':
            start = datetime(now.year, now.month, 1, 0, 0, 0)
            end = now
        elif period == 'custom':
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d")
                end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
            except (ValueError, TypeError):
                return jsonify({
                    'success': False,
                    'error': 'Invalid date format. Use YYYY-MM-DD.'
                }), 400
        else:
            start = datetime(now.year, now.month, now.day, 0, 0, 0)
            end = datetime(now.year, now.month, now.day, 23, 59, 59)
        
        # Get top products by quantity sold
        top_by_quantity = db.session.query(
            Product.id,
            Product.name,
            Product.category,
            func.sum(TransactionItem.quantity).label('quantity_sold')
        ).join(
            TransactionItem, TransactionItem.product_id == Product.id
        ).join(
            Transaction, Transaction.id == TransactionItem.transaction_id
        ).filter(
            Transaction.transaction_date.between(start, end)
        ).group_by(
            Product.id, Product.name, Product.category
        ).order_by(
            func.sum(TransactionItem.quantity).desc()
        ).limit(limit).all()
        
        # Get top products by revenue
        top_by_revenue = db.session.query(
            Product.id,
            Product.name,
            Product.category,
            func.sum(TransactionItem.total_price).label('total_revenue')
        ).join(
            TransactionItem, TransactionItem.product_id == Product.id
        ).join(
            Transaction, Transaction.id == TransactionItem.transaction_id
        ).filter(
            Transaction.transaction_date.between(start, end)
        ).group_by(
            Product.id, Product.name, Product.category
        ).order_by(
            func.sum(TransactionItem.total_price).desc()
        ).limit(limit).all()
        
        # Format data
        quantity_data = [
            {
                'id': id,
                'name': name,
                'category': category,
                'quantity_sold': quantity_sold
            }
            for id, name, category, quantity_sold in top_by_quantity
        ]
        
        revenue_data = [
            {
                'id': id,
                'name': name,
                'category': category,
                'total_revenue': float(total_revenue) if total_revenue else 0
            }
            for id, name, category, total_revenue in top_by_revenue
        ]
        
        return jsonify({
            'success': True,
            'data': {
                'period': {
                    'start': start.isoformat(),
                    'end': end.isoformat(),
                    'name': period
                },
                'top_by_quantity': quantity_data,
                'top_by_revenue': revenue_data
            }
        })
    except Exception as e:
        logging.error(f"Error generating top products report: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@reports_bp.route('/inventory/status', methods=['GET'])
def inventory_status():
    """API endpoint to get current inventory status"""
    try:
        # Get low stock threshold from query params (default to 10)
        low_stock_threshold = int(request.args.get('low_stock', 10))
        
        # Get all products with stock info
        products = Product.query.all()
        
        # Calculate inventory statistics
        total_products = len(products)
        out_of_stock = sum(1 for p in products if p.stock_quantity <= 0)
        low_stock = sum(1 for p in products if 0 < p.stock_quantity <= low_stock_threshold)
        
        # Calculate total inventory value
        total_value = sum(p.price * p.stock_quantity for p in products)
        
        # Get products with low stock
        low_stock_products = Product.query.filter(
            Product.stock_quantity > 0,
            Product.stock_quantity <= low_stock_threshold
        ).all()
        
        # Get out of stock products
        out_of_stock_products = Product.query.filter(
            Product.stock_quantity <= 0
        ).all()
        
        # Format data
        low_stock_data = [product.to_dict() for product in low_stock_products]
        out_of_stock_data = [product.to_dict() for product in out_of_stock_products]
        
        return jsonify({
            'success': True,
            'data': {
                'summary': {
                    'total_products': total_products,
                    'out_of_stock': out_of_stock,
                    'low_stock': low_stock,
                    'total_value': float(total_value)
                },
                'low_stock_threshold': low_stock_threshold,
                'low_stock_products': low_stock_data,
                'out_of_stock_products': out_of_stock_data
            }
        })
    except Exception as e:
        logging.error(f"Error generating inventory status report: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
